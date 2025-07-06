import React from 'react';
import type { FolderNode } from './FolderTree';

interface SidebarProps {
  selectedNode: FolderNode | null;
  selectedNodePath: string | null;
}

export const Sidebar: React.FC<SidebarProps> = ({ selectedNode, selectedNodePath }) => {
  if (!selectedNode) {
    return (
      <aside className="sidebar">
        <h2>Node Info</h2>
        <div style={{ color: '#888' }}>No node selected.</div>
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
        <strong>Path:</strong> {selectedNodePath}
      </div>
      <div>
        <strong>Children:</strong> {selectedNode.children ? selectedNode.children.length : 0}
      </div>
    </aside>
  );
};