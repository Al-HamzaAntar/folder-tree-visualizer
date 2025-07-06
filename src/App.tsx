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
  const [parsedTree, setParsedTree] = useState<FolderNode | null>(null);
  const [search, setSearch] = useState(() => localStorage.getItem('search') || '');
  const [selectedNodePath, setSelectedNodePath] = useState<string | null>(() => localStorage.getItem('selectedNodePath'));
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

  // Persist form data in localStorage
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
    localStorage.setItem('selectedNodePath', selectedNodePath || '');
  }, [selectedNodePath]);
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
    setSelectedNodePath(null);
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
  if (parsedTree && selectedNodePath) {
    selectedNode = findNodeByPath(parsedTree, selectedNodePath.split('/'));
  }

  // Handle search
  useEffect(() => {
    if (search && parsedTree) {
      const foundPath = findNodeByName(parsedTree, search);
      if (foundPath) setSelectedNodePath(foundPath);
    }
  }, [search, parsedTree, findNodeByName]);

  // In App component, update setCollapsed to use functional form
  const handleSetCollapsed = (updater: (prev: Record<string, boolean>) => Record<string, boolean>) => {
    setCollapsed(updater);
  };

  // --- Drag-and-drop move logic ---
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
    if (sourcePathStr === targetPathStr || isDescendant(sourcePath, targetPath)) {
      alert('Invalid move: cannot move a node into itself or its descendant.');
      return;
    }
    const { removed, tree: treeWithoutSource } = removeNodeByPath(parsedTree, sourcePath);
    if (!removed) return;
    const newTree = insertNodeAtPath(treeWithoutSource, targetPath, removed);
    setParsedTree(newTree);
    setSelectedNodePath(null);
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
              selectedNodePath={selectedNodePath}
              setSelectedNodePath={setSelectedNodePath}
              search={search}
              onNodeMove={moveNodeInTree}
            />
          </div>
        )}
      </div>
      <Sidebar selectedNode={selectedNode} selectedNodePath={selectedNodePath} />
    </div>
  );
}

export default App;