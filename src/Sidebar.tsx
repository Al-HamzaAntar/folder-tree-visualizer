import React from 'react';
import type { FolderNode } from './FolderTree';

interface SidebarProps {
  selectedNode: FolderNode | null;
  selectedNodePaths: string[];
  onDeleteSelected: () => void;
  onMoveSelected: () => void;
  onExpandCollapseSelected: (expand: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ selectedNode, selectedNodePaths, onDeleteSelected, onMoveSelected, onExpandCollapseSelected }) => {
  const hasSelection = selectedNodePaths.length > 0;
  if (!selectedNode) {
    return (
      <aside className="sidebar">
        <h2>Node Info</h2>
        <div style={{ color: '#888' }}>No node selected.</div>
        {hasSelection && (
          <div style={{ marginTop: 16 }}>
            <button onClick={onDeleteSelected}>Delete Selected</button>
            <button onClick={onMoveSelected} style={{ marginLeft: 8 }}>Move Selected</button>
            <button onClick={() => onExpandCollapseSelected(true)} style={{ marginLeft: 8 }}>Expand Selected</button>
            <button onClick={() => onExpandCollapseSelected(false)} style={{ marginLeft: 8 }}>Collapse Selected</button>
          </div>
        )}
      </aside>
    );
  }
  return (
    <aside className="sidebar">
      <h2>Node Info</h2>
      <div>
        <strong>Name:</strong> {selectedNode.name}
      </div>
      <div>
        <strong>Paths:</strong> {selectedNodePaths.join(', ')}
      </div>
      <div>
        <strong>Children:</strong> {selectedNode.children ? selectedNode.children.length : 0}
      </div>
      {hasSelection && (
        <div style={{ marginTop: 16 }}>
          <button onClick={onDeleteSelected}>Delete Selected</button>
          <button onClick={onMoveSelected} style={{ marginLeft: 8 }}>Move Selected</button>
          <button onClick={() => onExpandCollapseSelected(true)} style={{ marginLeft: 8 }}>Expand Selected</button>
          <button onClick={() => onExpandCollapseSelected(false)} style={{ marginLeft: 8 }}>Collapse Selected</button>
        </div>
      )}
    </aside>
  );
};