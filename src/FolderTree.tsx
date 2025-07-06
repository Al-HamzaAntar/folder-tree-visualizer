import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';
import type { MouseEvent } from 'react';

export interface FolderNode {
  name: string;
  children?: FolderNode[];
}

interface FolderTreeProps {
  tree: FolderNode;
  collapsed: Record<string, boolean>;
  setCollapsed: (updater: (prev: Record<string, boolean>) => Record<string, boolean>) => void;
  selectedNodePaths: string[];
  setSelectedNodePaths: React.Dispatch<React.SetStateAction<string[]>>;
  search: string;
  onNodeMove: (sourcePath: string, targetPath: string) => void;
  onRenameNode: (path: string, newName: string) => void;
}

function cloneWithCollapse(node: FolderNode, collapsed: Record<string, boolean>, path: string[] = []): FolderNode {
  const nodePath = [...path, node.name].join('/');
  if (collapsed[nodePath] && node.children && node.children.length > 0) {
    return { ...node, children: undefined };
  }
  return {
    ...node,
    children: node.children?.map(child => cloneWithCollapse(child, collapsed, [...path, node.name]))
  };
}

export const FolderTree: React.FC<FolderTreeProps> = ({
  tree,
  collapsed,
  setCollapsed,
  selectedNodePaths,
  setSelectedNodePaths,
  search,
  onNodeMove,
  onRenameNode
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const gRef = useRef<SVGGElement | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null);
  const [zoomTransform, setZoomTransform] = useState<d3.ZoomTransform | null>(null);
  const [editingNodePath, setEditingNodePath] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const [inputPosition, setInputPosition] = useState<{ x: number; y: number } | null>(null);

  const handleNodeClick = useCallback((d: d3.HierarchyPointNode<FolderNode>, event?: MouseEvent) => {
    const path = d.ancestors().reverse().map(n => n.data.name).join('/');
    setCollapsed(prev => ({ ...prev, [path]: !prev[path] }));
    if (event && (event.ctrlKey || event.metaKey)) {
      setSelectedNodePaths((prev: string[]) => prev.includes(path) ? prev.filter((p: string) => p !== path) : [...prev, path]);
    } else {
      setSelectedNodePaths([path]);
    }
  }, [setCollapsed, setSelectedNodePaths]);

  const handleNodeMouseOver = (event: MouseEvent, d: d3.HierarchyPointNode<FolderNode>) => {
    if (!svgRef.current) return;
    const svgRect = svgRef.current.getBoundingClientRect();
    setTooltip({
      x: event.clientX - svgRect.left,
      y: event.clientY - svgRect.top,
      content: `Name: ${d.data.name}\nPath: ${d.ancestors().reverse().map(n => n.data.name).join('/')}`
    });
  };
  const handleNodeMouseOut = () => setTooltip(null);

  // Helper to get node path
  const getNodePath = (d: d3.HierarchyPointNode<FolderNode>) => d.ancestors().reverse().map(n => n.data.name).join('/');

  // Double-click handler for renaming
  const handleNodeDoubleClick = (event: any, d: d3.HierarchyPointNode<FolderNode>) => {
    event.stopPropagation();
    const path = getNodePath(d);
    setEditingNodePath(path);
    setEditingValue(d.data.name);
    // Get SVG position for input overlay
    if (svgRef.current) {
      const svgRect = svgRef.current.getBoundingClientRect();
      const pt = svgRef.current.createSVGPoint();
      pt.x = event.clientX - svgRect.left;
      pt.y = event.clientY - svgRect.top;
      setInputPosition({ x: pt.x, y: pt.y });
    }
  };

  // Handle input submit (Enter or blur)
  const handleInputSubmit = () => {
    if (editingNodePath && editingValue.trim()) {
      onRenameNode(editingNodePath, editingValue.trim());
    }
    setEditingNodePath(null);
    setEditingValue('');
    setInputPosition(null);
  };

  useEffect(() => {
    if (!tree || !svgRef.current || !gRef.current) return;
    d3.select(gRef.current).selectAll('*').remove();
    const collapsedTree = cloneWithCollapse(tree, collapsed);
    const root = d3.hierarchy(collapsedTree, d => d.children) as d3.HierarchyPointNode<FolderNode>;
    const treeLayout = d3.tree<FolderNode>().nodeSize([40, 160]);
    treeLayout(root);
    const width = 600;
    const height = Math.max(300, root.height * 60 + 60);
    const nodes = root.descendants() as d3.HierarchyPointNode<FolderNode>[];
    const minX = Math.min(...nodes.map(n => n.x));
    const maxX = Math.max(...nodes.map(n => n.x));
    const treeHeight = maxX - minX;
    const centerY = width / 2;
    const centerX = (height - treeHeight) / 2 - minX;
    const svg = d3.select(svgRef.current)
      .attr('width', '100%')
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .style('background', '#f8fafc')
      .style('border-radius', '12px');
    const g = d3.select(gRef.current)
      .attr('transform', zoomTransform ? zoomTransform.toString() : `translate(${centerY},${centerX})`);
    g.append('g')
      .selectAll('path')
      .data(root.links() as d3.HierarchyPointLink<FolderNode>[])
      .join('path')
      .attr('d', d3.linkHorizontal<d3.HierarchyPointLink<FolderNode>, d3.HierarchyPointNode<FolderNode>>()
        .x(d => d.y - width / 2)
        .y(d => d.x - minX)
      )
      .attr('fill', 'none')
      .attr('stroke', '#94a3b8')
      .attr('stroke-width', 2);
    const node = g.append('g')
      .selectAll<SVGGElement, d3.HierarchyPointNode<FolderNode>>('g')
      .data(nodes)
      .join('g')
      .attr('transform', d => `translate(${d.y - width / 2},${d.x - minX})`)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        handleNodeClick(d, event);
      })
      .on('mouseover', (event, d) => handleNodeMouseOver(event, d))
      .on('mouseout', handleNodeMouseOut)
      .on('dblclick', handleNodeDoubleClick);
    let dragSource: d3.HierarchyPointNode<FolderNode> | null = null;
    let dragTarget: d3.HierarchyPointNode<FolderNode> | null = null;
    const drag = d3.drag<SVGGElement, d3.HierarchyPointNode<FolderNode>>()
      .on('start', function(d) {
        dragSource = d;
        d3.select(this).select('circle').attr('stroke', '#fbbf24').attr('stroke-width', 5);
      })
      .on('drag', function(event) {
        d3.select(this).attr('transform', `translate(${event.x},${event.y})`);
      })
      .on('end', function() {
        d3.select(this).select('circle').attr('stroke', null).attr('stroke-width', null);
        if (dragTarget && dragSource && dragTarget !== dragSource) {
          const sourcePath = dragSource.ancestors().reverse().map(n => n.data.name).join('/');
          const targetPath = dragTarget.ancestors().reverse().map(n => n.data.name).join('/');
          onNodeMove(sourcePath, targetPath);
        }
        dragSource = null;
        dragTarget = null;
      });
    (node as d3.Selection<SVGGElement, d3.HierarchyPointNode<FolderNode>, SVGGElement, unknown>).call(drag);
    node.on('mouseenter', function(d) {
      if (dragSource && dragSource !== d) {
        dragTarget = d;
        d3.select(this).select('circle').attr('stroke', '#22d3ee').attr('stroke-width', 5);
      }
    });
    node.on('mouseleave', function(d) {
      if (dragSource && dragTarget === d) {
        dragTarget = null;
        d3.select(this).select('circle').attr('stroke', null).attr('stroke-width', null);
      }
    });
    node.append('circle')
      .attr('r', 16)
      .attr('fill', d => {
        const path = d.ancestors().reverse().map(n => n.data.name).join('/');
        if (selectedNodePaths.includes(path)) return '#f59e42';
        if (search && d.data.name.toLowerCase().includes(search.toLowerCase())) return '#22d3ee';
        return '#6366f1';
      })
      .attr('stroke', d => {
        const path = d.ancestors().reverse().map(n => n.data.name).join('/');
        return selectedNodePaths.includes(path) ? '#ea580c' : 'none';
      })
      .attr('stroke-width', d => {
        const path = d.ancestors().reverse().map(n => n.data.name).join('/');
        return selectedNodePaths.includes(path) ? 4 : 0;
      });
    node.append('text')
      .text(d => d.data.name)
      .attr('dy', '0.35em')
      .attr('x', d => d.children ? -22 : 22)
      .attr('text-anchor', d => d.children ? 'end' : 'start')
      .attr('font-size', 15)
      .attr('fill', '#22223b');
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 2])
      .on('zoom', (event) => {
        setZoomTransform(event.transform);
      });
    svg.call(zoom as d3.ZoomBehavior<SVGSVGElement, unknown>);
  }, [tree, collapsed, zoomTransform, selectedNodePaths, search, setCollapsed, handleNodeClick, onNodeMove]);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg ref={svgRef} style={{ width: '100%', minHeight: 300 }}>
        <g ref={gRef}></g>
      </svg>
      {editingNodePath && inputPosition && (
        <input
          type="text"
          value={editingValue}
          autoFocus
          style={{
            position: 'absolute',
            left: inputPosition.x,
            top: inputPosition.y,
            zIndex: 2000,
            fontSize: 15,
            padding: '2px 6px',
            borderRadius: 4,
            border: '1px solid #888',
            background: '#fff',
            minWidth: 60
          }}
          onChange={e => setEditingValue(e.target.value)}
          onBlur={handleInputSubmit}
          onKeyDown={e => {
            if (e.key === 'Enter') handleInputSubmit();
            if (e.key === 'Escape') {
              setEditingNodePath(null);
              setEditingValue('');
              setInputPosition(null);
            }
          }}
        />
      )}
      {tooltip && (
        <div
          style={{
            position: 'absolute',
            left: tooltip.x + 12,
            top: tooltip.y + 12,
            background: 'rgba(30,41,59,0.97)',
            color: '#fff',
            padding: '8px 14px',
            borderRadius: 8,
            fontSize: 14,
            pointerEvents: 'none',
            zIndex: 1000,
            whiteSpace: 'pre-line',
            boxShadow: '0 2px 8px 0 rgba(30,41,59,0.18)'
          }}
        >
            {tooltip.content}
          </div>
        )}
      </div>
        );
    };