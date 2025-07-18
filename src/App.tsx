import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import './App.css'
import { FolderTree } from './FolderTree'
import { Sidebar } from './Sidebar'
import { InputForm } from './InputForm'
import type { FolderNode } from './FolderTree'

// Types for form data
interface FormData {
  inputType: 'json' | 'path';
  jsonInput?: string;
  pathInput?: string;
}

// Utility: Parse folder path string into FolderNode
function parsePathInput(path: string): FolderNode {
  const segments = path.split(/\\|\//).filter(Boolean);
  if (segments.length === 0) {
    return { name: '', children: [] };
  }
  const node: FolderNode = { name: segments[0], children: [] };
  let current = node;
  for (let i = 1; i < segments.length; i++) {
    const child: FolderNode = { name: segments[i], children: [] };
    current.children!.push(child);
    current = child;
  }
  return node;
}

function App() {
  // Load parsedTree from localStorage if available 
  const getInitialTree = () => {
    const saved = localStorage.getItem('jsonInput');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  };
  const [parsedTree, setParsedTree] = useState<FolderNode | null>(getInitialTree);
  const [search, setSearch] = useState(() => localStorage.getItem('search') || '');
  const [selectedNodePaths, setSelectedNodePaths] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('selectedNodePaths') || '[]');
    } catch {
      return [];
    }
  });
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem('collapsed') || '{}');
    } catch {
      return {};
    }
  });

  // React Hook Form setup
  const { control, handleSubmit, watch } = useForm<FormData>({
    defaultValues: {
      inputType: (localStorage.getItem('inputType') as 'json' | 'path') || 'json',
      jsonInput: localStorage.getItem('jsonInput') || '',
      pathInput: localStorage.getItem('pathInput') || ''
    }
  });

  const watchedInputType = watch('inputType');
  const watchedJsonInput = watch('jsonInput');
  const watchedPathInput = watch('pathInput');

  // Persist form data in localStoragePersist
  useEffect(() => {
    localStorage.setItem('inputType', watchedInputType);
  }, [watchedInputType]);
  useEffect(() => {
    localStorage.setItem('jsonInput', watchedJsonInput || '');
  }, [watchedJsonInput]);
  useEffect(() => {
    localStorage.setItem('pathInput', watchedPathInput || '');
  }, [watchedPathInput]);
  useEffect(() => {
    localStorage.setItem('search', search);
  }, [search]);
  useEffect(() => {
    localStorage.setItem('selectedNodePaths', JSON.stringify(selectedNodePaths));
  }, [selectedNodePaths]);
  useEffect(() => {
    localStorage.setItem('collapsed', JSON.stringify(collapsed));
  }, [collapsed]);
  useEffect(() => {
    if (parsedTree) {
      localStorage.setItem('jsonInput', JSON.stringify(parsedTree, null, 2));
    }
  }, [parsedTree]);

  // Parse input on submit
  const onSubmit = (data: FormData) => {
    let tree: FolderNode | null = null;
    if (data.inputType === 'json') {
      try { tree = JSON.parse(data.jsonInput || ''); } catch { tree = null; }
    } else if (data.inputType === 'path') {
      tree = parsePathInput(data.pathInput || '');
    }
    setParsedTree(tree);
    setSelectedNodePaths([]);
    // Save to localStorage immediately
    if (tree) {
      localStorage.setItem('jsonInput', JSON.stringify(tree, null, 2));
    }
  };

  // Search helpers
  const findNodeByName = useCallback((node: FolderNode, name: string | undefined, path: string[] = []): string | null => {
    if (!name) return null;
    if (node.name.toLowerCase().includes(name.toLowerCase())) {
      return [...path, node.name].join('/');
    }
    if (node.children) {
      for (const child of node.children) {
        const found = findNodeByName(child, name, [...path, node.name]);
        if (found) return found;
      }
    }
    return null;
  }, []);

  // Sidebar node info
  let selectedNode: FolderNode | null = null;
  function findNodeByPath(node: FolderNode, path: (string | undefined)[]): FolderNode | null {
    if (!path.length || !path[0]) return node;
    if (node.name === path[0]) {
      if (path.length === 1) return node;
      if (node.children) {
        for (const child of node.children) {
          const found = findNodeByPath(child, path.slice(1));
          if (found) return found;
        }
      }
    }
    return null;
  }
  if (parsedTree && selectedNodePaths.length > 0) {
    selectedNode = findNodeByPath(parsedTree, selectedNodePaths[0].split('/'));
  }

  // Handle search
  useEffect(() => {
    if (search && parsedTree) {
      const foundPath = findNodeByName(parsedTree, search);
      if (foundPath) setSelectedNodePaths([foundPath]);
    }
  }, [search, parsedTree, findNodeByName]);

  // In App component, update setCollapsed to use functional form
  const handleSetCollapsed = (updater: (prev: Record<string, boolean>) => Record<string, boolean>) => {
    setCollapsed(updater);
  };

  // Drag-and-drop move logic
  function removeNodeByPath(node: FolderNode, path: string[]): { removed: FolderNode | null, tree: FolderNode } {
    if (path.length === 0) return { removed: null, tree: node };
    if (path.length === 1) {
      if (!node.children) return { removed: null, tree: node };
      const idx = node.children.findIndex(child => child.name === path[0]);
      if (idx === -1) return { removed: null, tree: node };
      const removed = node.children[idx];
      const newChildren = [...node.children.slice(0, idx), ...node.children.slice(idx + 1)];
      return { removed, tree: { ...node, children: newChildren } };
    }
    if (!node.children) return { removed: null, tree: node };
    const idx = node.children.findIndex(child => child.name === path[0]);
    if (idx === -1) return { removed: null, tree: node };
    const { removed, tree: newChild } = removeNodeByPath(node.children[idx], path.slice(1));
    const newChildren = [...node.children];
    newChildren[idx] = newChild;
    return { removed, tree: { ...node, children: newChildren } };
  }

  function insertNodeAtPath(node: FolderNode, path: string[], toInsert: FolderNode): FolderNode {
    if (path.length === 0) {
      return { ...node, children: [...(node.children || []), toInsert] };
    }
    if (!node.children) return node;
    const idx = node.children.findIndex(child => child.name === path[0]);
    if (idx === -1) return node;
    const newChildren = [...node.children];
    newChildren[idx] = insertNodeAtPath(node.children[idx], path.slice(1), toInsert);
    return { ...node, children: newChildren };
  }

  function isDescendant(sourcePath: string[], targetPath: string[]): boolean {
    if (targetPath.length < sourcePath.length) return false;
    for (let i = 0; i < sourcePath.length; i++) {
      if (sourcePath[i] !== targetPath[i]) return false;
    }
    return targetPath.length > sourcePath.length;
  }

  function moveNodeInTree(sourcePathStr: string, targetPathStr: string) {
    if (!parsedTree) return;
    const sourcePath = sourcePathStr.split('/');
    const targetPath = targetPathStr.split('/');
    if (sourcePathStr === targetPathStr || isDescendant(sourcePath, targetPath) || isDescendant(targetPath, sourcePath)) {
      alert('Invalid move: cannot swap a node with itself or its descendant.');
      return;
    }
    // Remove both nodes
    const sourceResult = removeNodeByPath(parsedTree, sourcePath);
    if (!sourceResult.removed) return;
    const treeWithoutSource = sourceResult.tree;
    // Adjust target path if source was before target in the tree
    const targetResult = removeNodeByPath(treeWithoutSource, targetPath);
    if (!targetResult.removed) return;
    let newTree = targetResult.tree;
    // Insert source at target's original location
    newTree = insertNodeAtPath(newTree, targetPath, sourceResult.removed);
    // Insert target at source's original location
    newTree = insertNodeAtPath(newTree, sourcePath, targetResult.removed);
    setParsedTree(newTree);
    setSelectedNodePaths([]);
    localStorage.setItem('jsonInput', JSON.stringify(newTree, null, 2));
  }

  function renameNodeByPath(node: FolderNode, path: string[], newName: string): FolderNode {
    if (path.length === 0) return { ...node, name: newName };
    if (node.name === path[0]) {
      if (path.length === 1) {
        return { ...node, name: newName };
      }
      if (node.children) {
        return {
          ...node,
          children: node.children.map(child =>
            child.name === path[1]
              ? renameNodeByPath(child, path.slice(1), newName)
              : child
          )
        };
      }
    }
    return node;
  }

  function handleRenameNode(pathStr: string, newName: string) {
    if (!parsedTree) return;
    const path = pathStr.split('/');
    setParsedTree(renameNodeByPath(parsedTree, path, newName));
  }

  // --- Batch Actions ---
  function handleDeleteSelected() {
    if (!parsedTree || selectedNodePaths.length === 0) return;
    let newTree = parsedTree;
    // Sort paths by depth descending (children before parents)
    const sortedPaths = [...selectedNodePaths].sort((a, b) => b.split('/').length - a.split('/').length);
    sortedPaths.forEach(pathStr => {
      const path = pathStr.split('/');
      const result = removeNodeByPath(newTree, path);
      newTree = result.tree;
    });
    setParsedTree(newTree);
    setSelectedNodePaths([]);
  }

  function handleMoveSelected() {
    if (!parsedTree || selectedNodePaths.length === 0) return;
    const targetPath = window.prompt('Enter the target folder path to move selected nodes into:');
    if (!targetPath) return;
    // Check if target path exists
    const targetPathArr = targetPath.split('/');
    const targetNode = findNodeByPath(parsedTree, targetPathArr);
    if (!targetNode) {
      alert('Target path does not exist!');
      return;
    }
    let newTree = parsedTree;
    // Sort paths by depth descending (children before parents)
    const sortedPaths = [...selectedNodePaths].sort((a, b) => b.split('/').length - a.split('/').length);
    // Only move top-level selected nodes (not descendants of other selected nodes)
    const isDescendantOfAny = (path: string, others: string[]) =>
      others.some(other => path !== other && path.startsWith(other + '/'));
    const topLevelPaths = sortedPaths.filter(path => !isDescendantOfAny(path, sortedPaths));
    // Remove all top-level selected nodes first, collect them
    const removedNodes: FolderNode[] = [];
    topLevelPaths.forEach(pathStr => {
      const path = pathStr.split('/');
      const result = removeNodeByPath(newTree, path);
      if (result.removed) removedNodes.push(result.removed);
      newTree = result.tree;
    });
    // Insert all removed nodes into the target
    removedNodes.forEach(node => {
      newTree = insertNodeAtPath(newTree, targetPathArr, node);
    });
    setParsedTree(newTree);
    setSelectedNodePaths([]);
  }

  function handleExpandCollapseSelected(expand: boolean) {
    setCollapsed(prev => {
      const updated = { ...prev };
      selectedNodePaths.forEach(path => {
        updated[path] = !expand;
      });
      return updated;
    });
  }

  return (
    <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start', justifyContent: 'center' }}>
      <div className="app-container">
        <h1>Folder Tree Visualizer</h1>
        <InputForm
          control={control}
          handleSubmit={handleSubmit}
          onSubmit={onSubmit}
          watchedInputType={watchedInputType}
        />
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search node by name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {parsedTree && (
          <div className="d3-tree-container">
            <FolderTree
              tree={parsedTree}
              collapsed={collapsed}
              setCollapsed={handleSetCollapsed}
              selectedNodePaths={selectedNodePaths}
              setSelectedNodePaths={setSelectedNodePaths}
              search={search}
              onNodeMove={moveNodeInTree}
              onRenameNode={handleRenameNode}
            />
          </div>
        )}
      </div>
      <Sidebar
        selectedNode={selectedNode}
        selectedNodePaths={selectedNodePaths}
        onDeleteSelected={handleDeleteSelected}
        onMoveSelected={handleMoveSelected}
        onExpandCollapseSelected={handleExpandCollapseSelected}
      />
    </div>
  );
}

export default App;