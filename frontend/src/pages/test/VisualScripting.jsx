
import React, { useState, useEffect, useRef, useCallback } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { 
    Move, Plus, X, Trash2, Code, Play, 
    Check, ChevronRight, Minimize2, Maximize2, 
    ArrowRight, Activity, Clock, AlertCircle, ZoomIn, ZoomOut
} from 'lucide-react';
import { toast } from 'react-toastify';

// --- CONSTANTS & CONFIG ---

const VARIABLE_OPTIONS = [
    { label: "Minutes Late", value: "minutes_late", type: "number" },
    { label: "Total Hours", value: "total_hours", type: "number" },
    { label: "Total Hours Today", value: "total_hours_today", type: "number" },
    { label: "First Check-in Hour", value: "first_time_in_hour", type: "number" },
    { label: "Last Check-out Hour", value: "last_time_out_hour", type: "number" },
    { label: "Is First Session", value: "is_first_session", type: "boolean" }
];

const NODE_TYPES = {
    // Logic: Inputs=Boolean -> Output=Boolean
    LOGIC: { 
        type: 'LOGIC', color: 'bg-indigo-500', label: 'Logic', 
        inputs: [
            { name: 'A', type: 'boolean' }, 
            { name: 'B', type: 'boolean' }
        ], 
        outputs: [{ name: 'Result', type: 'boolean' }] 
    },
    
    // Compare: Inputs=Any/Number -> Output=Boolean
    COMPARE: { 
        type: 'COMPARE', color: 'bg-blue-500', label: 'Compare', 
        inputs: [
            { name: 'A', type: 'any' }, 
            { name: 'B', type: 'any' }
        ], 
        outputs: [{ name: 'Result', type: 'boolean' }] 
    },
    
    // Data: Inputs=[] -> Output=Derived
    VAR: { 
        type: 'VAR', color: 'bg-emerald-500', label: 'Variable', 
        inputs: [], 
        outputs: [{ name: 'Value', type: 'any' }] // Dynamic based on selection
    },
    CONST: { 
        type: 'CONST', color: 'bg-slate-500', label: 'Constant', 
        inputs: [], 
        outputs: [{ name: 'Value', type: 'any' }] // Dynamic
    },
    
    // Control Flow: Cond=Boolean -> Output=Any (Match True/False)
    IF: { 
        type: 'IF', color: 'bg-amber-500', label: 'If Condition', 
        inputs: [
            { name: 'Condition', type: 'boolean' }, 
            { name: 'True', type: 'any' }, 
            { name: 'False', type: 'any' }
        ], 
        outputs: [{ name: 'Result', type: 'any' }] 
    },
    
    // Result
    RESULT: { 
        type: 'RESULT', color: 'bg-rose-600', label: 'Policy Result', 
        inputs: [{ name: 'Rule', type: 'any' }], 
        outputs: [] 
    }
};

const OPERATORS = [
    { label: "AND", value: "and" },
    { label: "OR", value: "or" },
    { label: "NOT", value: "not" } // Handle unary differently if needed
];

const COMPARATORS = [
    { label: ">", value: ">" },
    { label: "<", value: "<" },
    { label: ">=", value: ">=" },
    { label: "<=", value: "<=" },
    { label: "==", value: "==" },
    { label: "!=", value: "!=" }
];

// --- COMPONENTS ---

// 1. Draggable Node Component
const Node = ({ node, isSelected, onMouseDown, onDelete, updateNodeData, scale }) => {
    const isLogic = node.type === 'LOGIC';
    const isCompare = node.type === 'COMPARE';
    const isVar = node.type === 'VAR';
    const isConst = node.type === 'CONST';
    
    const nodeDef = NODE_TYPES[node.type];

    // Dynamic Type handling for VAR
    const getVarType = () => {
        const v = VARIABLE_OPTIONS.find(opt => opt.value === node.data.value);
        return v ? v.type : 'any';
    };

    return (
        <div 
            className={`absolute shadow-lg rounded-lg border-2 flex flex-col w-48 transition-colors z-10
                ${isSelected ? 'border-yellow-400 ring-4 ring-yellow-400/30' : 'border-slate-700'}
                ${nodeDef.color}
            `}
            style={{ 
                left: node.x, 
                top: node.y,
                cursor: 'grab',
                transform: 'translateZ(0)' // Hardware accel
            }}
            onMouseDown={(e) => onMouseDown(e, node.id)}
        >
            {/* Header */}
            <div className="flex justify-between items-start p-2 border-b border-black/10">
                <span className="text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1">
                    {nodeDef.label}
                    <span className="opacity-50 text-[10px]">#{node.id.substr(0,4)}</span>
                </span>
                <button 
                    className="text-white/70 hover:text-white"
                    onMouseDown={(e) => { e.stopPropagation(); onDelete(node.id); }}
                >
                    <X size={14} />
                </button>
            </div>

            {/* Body */}
            <div className="p-3 bg-white dark:bg-slate-800 rounded-b-md space-y-3 relative">
                
                {/* Specific UI for Node Types */}
                
                {isLogic && (
                    <select 
                        className="w-full text-xs p-1 border rounded bg-slate-50 dark:bg-slate-900 dark:text-white dark:border-slate-700"
                        value={node.data.op || 'and'}
                        onChange={(e) => updateNodeData(node.id, { op: e.target.value })}
                        onMouseDown={e => e.stopPropagation()}
                    >
                        {OPERATORS.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                    </select>
                )}

                {isCompare && (
                    <select 
                        className="w-full text-xs p-1 border rounded bg-slate-50 dark:bg-slate-900 dark:text-white dark:border-slate-700"
                        value={node.data.op || '>'}
                        onChange={(e) => updateNodeData(node.id, { op: e.target.value })}
                        onMouseDown={e => e.stopPropagation()}
                    >
                        {COMPARATORS.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                    </select>
                )}

                {isVar && (
                    <select 
                        className="w-full text-xs p-1 border rounded bg-slate-50 dark:bg-slate-900 dark:text-white dark:border-slate-700"
                        value={node.data.value || 'minutes_late'}
                        onChange={(e) => updateNodeData(node.id, { value: e.target.value })}
                        onMouseDown={e => e.stopPropagation()}
                    >
                        {VARIABLE_OPTIONS.map(v => <option key={v.value} value={v.value}>{v.label} ({v.type})</option>)}
                    </select>
                )}

                {isConst && (
                    <div className="flex gap-1" onMouseDown={e => e.stopPropagation()}>
                        <select 
                            className="text-xs p-1 border rounded bg-slate-50 dark:bg-slate-900 dark:text-white dark:border-slate-700 w-16"
                            value={node.data.type || 'number'}
                            onChange={(e) => updateNodeData(node.id, { type: e.target.value, value: node.data.value })}
                        >
                            <option value="number">Num</option>
                            <option value="string">Str</option>
                            <option value="bool">Bool</option>
                        </select>
                        {node.data.type === 'bool' ? (
                            <select
                                className="flex-1 text-xs p-1 border rounded bg-slate-50 dark:bg-slate-900 dark:text-white dark:border-slate-700"
                                value={node.data.value}
                                onChange={(e) => updateNodeData(node.id, { value: e.target.value === 'true' })}
                            >
                                <option value="true">True</option>
                                <option value="false">False</option>
                            </select>
                        ) : (
                            <input 
                                type={node.data.type === 'number' ? 'number' : 'text'}
                                className="flex-1 text-xs p-1 border rounded bg-slate-50 dark:bg-slate-900 dark:text-white dark:border-slate-700 min-w-0"
                                value={node.data.value || ''}
                                onChange={(e) => updateNodeData(node.id, { value: node.data.type === 'number' ? parseFloat(e.target.value) : e.target.value })}
                                placeholder="Value..."
                            />
                        )}
                    </div>
                )}
            </div>

            {/* Ports */}
            {/* Inputs - Left */}
            <div className="absolute -left-3 top-10 flex flex-col gap-3">
                {nodeDef.inputs.map((input, idx) => (
                    <div 
                        key={idx} 
                        className="relative group flex items-center cursor-crosshair"
                        title={`${input.name} (${input.type})`}
                        data-node-id={node.id}
                        data-port-type="input"
                        data-port-name={input.name}
                        data-port-index={idx}
                        data-port-vartype={input.type}
                    >
                        {/* Hit Area (Invisible but occupies space) */}
                        <div className="w-6 h-6 -ml-3 absolute z-20"></div>
                        
                        {/* Visual Dot */}
                        <div className={`w-3 h-3 bg-white border-2 border-slate-500 rounded-full z-10 
                                       group-hover:border-yellow-500 group-hover:bg-yellow-100 transition-colors
                                       ${input.type === 'boolean' ? 'rounded-sm' : 'rounded-full'}
                        `}></div>
                        
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 bg-white/90 px-1 rounded pointer-events-none opacity-0 group-hover:opacity-100 whitespace-nowrap shadow-sm border border-slate-200 z-50">
                            {input.name} <span className="text-slate-300">|</span> {input.type}
                        </span>
                    </div>
                ))}
            </div>

            {/* Outputs - Right */}
            <div className="absolute -right-3 top-10 flex flex-col gap-3">
                {nodeDef.outputs.map((output, idx) => {
                    const outType = isVar ? getVarType() : (isConst ? node.data.type : output.type);
                    return (
                        <div 
                            key={idx} 
                            className="relative group flex items-center justify-end cursor-crosshair"
                            title={`${output.name} (${outType})`}
                            data-node-id={node.id}
                            data-port-type="output"
                            data-port-name={output.name}
                            data-port-index={idx}
                            data-port-vartype={outType}
                        >
                            {/* Hit Area */}
                            <div className="w-6 h-6 -mr-3 absolute z-20"></div>
                            
                            {/* Visual Dot */}
                            <div className={`w-3 h-3 bg-slate-800 border-2 border-white rounded-full z-10
                                           group-hover:scale-125 transition-transform
                                           ${outType === 'boolean' ? 'rounded-sm' : 'rounded-full'}
                            `}></div>

                             <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 bg-white/90 px-1 rounded pointer-events-none opacity-0 group-hover:opacity-100 whitespace-nowrap shadow-sm border border-slate-200 z-50">
                                {output.name} <span className="text-slate-300">|</span> {outType}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// --- MAIN PAGE ---

const VisualScripting = () => {
    // --- State ---
    const [nodes, setNodes] = useState([]);
    const [edges, setEdges] = useState([]); // { id, from: {nodeId, port}, to: {nodeId, port} }
    
    const [generatedJson, setGeneratedJson] = useState({});
    
    // Viewport
    const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
    
    // Canvas interactions
    const [draggingId, setDraggingId] = useState(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [connectionStart, setConnectionStart] = useState(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [lastPanPos, setLastPanPos] = useState({ x: 0, y: 0 });
    
    const canvasRef = useRef(null);

    // --- Graph Logic ---

    const addNode = (type) => {
        const id = Math.random().toString(36).substr(2, 9);
        // Find center of current viewport
        const centerX = (-viewport.x + (canvasRef.current?.clientWidth || 800) / 2) / viewport.zoom;
        const centerY = (-viewport.y + (canvasRef.current?.clientHeight || 600) / 2) / viewport.zoom;

        const newNode = {
            id,
            type,
            x: centerX - 100 + (Math.random() * 50),
            y: centerY - 50 + (Math.random() * 50),
            data: { value: '', op: '' }
        };
        
        // Defaults
        if (type === 'LOGIC') newNode.data.op = 'and';
        if (type === 'COMPARE') newNode.data.op = '>';
        if (type === 'VAR') newNode.data.value = 'minutes_late';
        if (type === 'CONST') { newNode.data.type = 'number'; newNode.data.value = 0; }
        
        setNodes(prev => [...prev, newNode]);
    };

    const deleteNode = (id) => {
        setNodes(nodes.filter(n => n.id !== id));
        setEdges(edges.filter(e => e.from.nodeId !== id && e.to.nodeId !== id));
    };

    const updateNodeData = (id, newData) => {
        setNodes(nodes.map(n => n.id === id ? { ...n, data: { ...n.data, ...newData } } : n));
    };

    // --- Helpers ---
    
    // Convert screen coordinates to world coordinates
    const toWorld = (screenX, screenY) => {
        if (!canvasRef.current) return { x: 0, y: 0 };
        const rect = canvasRef.current.getBoundingClientRect();
        return {
            x: (screenX - rect.left - viewport.x) / viewport.zoom,
            y: (screenY - rect.top - viewport.y) / viewport.zoom
        };
    };

    // --- Interaction Handlers ---

    const handleWheel = (e) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const zoomSensitivity = 0.001;
            const delta = -e.deltaY * zoomSensitivity;
            const newZoom = Math.min(Math.max(viewport.zoom + delta, 0.1), 3);
            
            // Zoom towards mouse pointer logic (simplified: zoom center)
            setViewport(prev => ({ ...prev, zoom: newZoom }));
        } else {
            // Pan
            setViewport(prev => ({
                ...prev,
                x: prev.x - e.deltaX,
                y: prev.y - e.deltaY
            }));
        }
    };

    const handleCanvasMouseDown = (e) => {
        // 1. Check for Port Click using .closest()
        const targetPort = e.target.closest('[data-port-type]');
        
        if (targetPort) {
            const type = targetPort.dataset.portType;
            const nodeId = targetPort.dataset.nodeId;
            const portIndex = parseInt(targetPort.dataset.portIndex);
            const varType = targetPort.dataset.portVartype;
            
            if (type === 'output') {
                const worldPos = toWorld(e.clientX, e.clientY);
                setConnectionStart({ 
                    nodeId, portIndex, varType,
                    startX: worldPos.x, startY: worldPos.y 
                });
                // Initialize mousePos immediately so line appears at cursor
                setMousePos(worldPos); 
            }
            return;
        }

        // 2. Start Pan
        setIsPanning(true);
        setLastPanPos({ x: e.clientX, y: e.clientY });
    };

    const handleMouseDownNode = (e, id) => {
         // If clicking a port, let it bubble to the canvas handler
        if (e.target.closest('[data-port-type]')) return;
        
        e.stopPropagation(); // Don't pan
        // Calculate offset from node top-left
        const node = nodes.find(n => n.id === id);
        const worldPos = toWorld(e.clientX, e.clientY);
        setDragOffset({
            x: worldPos.x - node.x,
            y: worldPos.y - node.y
        });
        setDraggingId(id);
    };

    const handleMouseMove = (e) => {
        const worldPos = toWorld(e.clientX, e.clientY);
        setMousePos(worldPos);

        // Pan
        if (isPanning) {
            const dx = e.clientX - lastPanPos.x;
            const dy = e.clientY - lastPanPos.y;
            setViewport(prev => ({
                ...prev,
                x: prev.x + dx,
                y: prev.y + dy
            }));
            setLastPanPos({ x: e.clientX, y: e.clientY });
        }

        // Drag Node
        if (draggingId) {
            setNodes(prev => prev.map(n => {
                if (n.id === draggingId) {
                    return {
                        ...n,
                        x: worldPos.x - dragOffset.x,
                        y: worldPos.y - dragOffset.y
                    };
                }
                return n;
            }));
        }
    };

    const handleMouseUp = (e) => {
        if (connectionStart) {
            // Check drop target
            const targetPort = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-port-type]');
            
            if (targetPort && targetPort.dataset.portType === 'input') {
                const toNodeId = targetPort.dataset.nodeId;
                const toPortIndex = parseInt(targetPort.dataset.portIndex);
                const toVarType = targetPort.dataset.portVartype;
                // Type Checking
                const fromType = connectionStart.varType;
                
                // Allow 'any' to connect to anything, or matching types
                let typeMatch = false;
                if (toVarType === 'any' || fromType === 'any') typeMatch = true;
                if (toVarType === fromType) typeMatch = true;
                
                if (connectionStart.nodeId !== toNodeId && typeMatch) {
                   const newEdge = {
                        id: Math.random().toString(36).substr(2, 9),
                        from: { nodeId: connectionStart.nodeId, portIndex: connectionStart.portIndex },
                        to: { nodeId: toNodeId, portIndex: toPortIndex }
                    };
                    
                    // Remove existing edge to this specific input port (1-to-1 input)
                    const filteredEdges = edges.filter(ed => 
                        !(ed.to.nodeId === toNodeId && ed.to.portIndex === toPortIndex)
                    );
                    
                    setEdges([...filteredEdges, newEdge]); 
                } else if (!typeMatch) {
                    toast.error(`Type mismatch: Cannot connect ${fromType} to ${toVarType}`);
                }
            }
        }

        setDraggingId(null);
        setConnectionStart(null);
        setIsPanning(false);
    };

    // --- JSON Logic (Same as before) ---
    const buildRule = useCallback((nodeId) => {
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return null;

        if (node.type === 'CONST') return node.data.value;
        if (node.type === 'VAR') return { "var": node.data.value };

        if (node.type === 'COMPARE') {
            const edgeA = edges.find(e => e.to.nodeId === nodeId && e.to.portIndex === 0);
            const edgeB = edges.find(e => e.to.nodeId === nodeId && e.to.portIndex === 1);
            return { [node.data.op]: [edgeA ? buildRule(edgeA.from.nodeId) : null, edgeB ? buildRule(edgeB.from.nodeId) : null] };
        }

        if (node.type === 'LOGIC') {
            const edgeA = edges.find(e => e.to.nodeId === nodeId && e.to.portIndex === 0);
            const edgeB = edges.find(e => e.to.nodeId === nodeId && e.to.portIndex === 1);
            if (node.data.op === 'not') return { "not": edgeA ? buildRule(edgeA.from.nodeId) : null };
            return { [node.data.op]: [edgeA ? buildRule(edgeA.from.nodeId) : null, edgeB ? buildRule(edgeB.from.nodeId) : null] };
        }

        if (node.type === 'IF') {
            const edgeCond = edges.find(e => e.to.nodeId === nodeId && e.to.portIndex === 0);
            const edgeTrue = edges.find(e => e.to.nodeId === nodeId && e.to.portIndex === 1);
            const edgeFalse = edges.find(e => e.to.nodeId === nodeId && e.to.portIndex === 2);
            return {
                "if": [
                    edgeCond ? buildRule(edgeCond.from.nodeId) : true,
                    edgeTrue ? buildRule(edgeTrue.from.nodeId) : "PRESENT",
                    edgeFalse ? buildRule(edgeFalse.from.nodeId) : null
                ]
            };
        }
        return null;
    }, [nodes, edges]);

    useEffect(() => {
        const results = nodes.filter(n => n.type === 'RESULT');
        const policyRules = results.map(rNode => {
            const edge = edges.find(e => e.to.nodeId === rNode.id && e.to.portIndex === 0);
            return edge ? buildRule(edge.from.nodeId) : null;
        }).filter(r => r !== null);
        setGeneratedJson({ status_rules: policyRules });
    }, [nodes, edges, buildRule]);

    // Import Logic (Simplified for brevity, assuming similar structure)
    // To properly support scale/pan, we place nodes relative to origin 0,0
    const importJSON = (jsonString) => {
        try {
            const obj = JSON.parse(jsonString);
            if (!obj.status_rules) throw new Error("Invalid");
            let newNodes = [], newEdges = [];
            
            const createNode = (rule, x, y) => {
                const id = Math.random().toString(36).substr(2, 9);
                // ... (Implementation same as previous but with updated data structures)
                // Focusing on core functionality first
                
                // Fallback implementation for quick fix
                if (typeof rule !== 'object' || rule === null) {
                    newNodes.push({ id, type: 'CONST', x, y, data: { type: typeof rule, value: rule }});
                    return id;
                }
                if (rule.var) {
                    newNodes.push({ id, type: 'VAR', x, y, data: { value: rule.var }});
                    return id;
                }
                const op = Object.keys(rule)[0];
                const args = rule[op];
                
                if (['and','or','not'].includes(op)) {
                    newNodes.push({ id, type: 'LOGIC', x, y, data: { op }});
                    if (Array.isArray(args)) {
                        args.forEach((a, i) => {
                            if (i > 1) return;
                            const cId = createNode(a, x - 250, y + (i*100) - 50);
                            newEdges.push({ id: Math.random().toString(), from: { nodeId: cId, portIndex: 0 }, to: { nodeId: id, portIndex: i }});
                        });
                    }
                     return id;
                }
                 if (['>','<','>=','<=','==','!='].includes(op)) {
                    newNodes.push({ id, type: 'COMPARE', x, y, data: { op }});
                     if (Array.isArray(args)) {
                        const cA = createNode(args[0], x - 250, y - 60);
                        const cB = createNode(args[1], x - 250, y + 60);
                        newEdges.push({ id: Math.random().toString(), from: { nodeId: cA, portIndex: 0 }, to: { nodeId: id, portIndex: 0 }});
                        newEdges.push({ id: Math.random().toString(), from: { nodeId: cB, portIndex: 0 }, to: { nodeId: id, portIndex: 1 }});
                     }
                     return id;
                }
                if (op === 'if') {
                     newNodes.push({ id, type: 'IF', x, y, data: {} });
                     const c1 = createNode(args[0], x - 250, y - 100);
                     const c2 = createNode(args[1], x - 250, y);
                     const c3 = args[2] ? createNode(args[2], x - 250, y + 100) : null;
                     newEdges.push({ id: Math.random().toString(), from: { nodeId: c1, portIndex: 0 }, to: { nodeId: id, portIndex: 0 }});
                     newEdges.push({ id: Math.random().toString(), from: { nodeId: c2, portIndex: 0 }, to: { nodeId: id, portIndex: 1 }});
                     if (c3) newEdges.push({ id: Math.random().toString(), from: { nodeId: c3, portIndex: 0 }, to: { nodeId: id, portIndex: 2 }});
                     return id;
                }
                
                return id;
            };

            obj.status_rules.forEach((r, i) => {
                const rid = createNode(r, 600, i * 400 + 100);
                const resId = Math.random().toString();
                newNodes.push({ id: resId, type: 'RESULT', x: 900, y: i * 400 + 100, data: {} });
                newEdges.push({ id: Math.random().toString(), from: { nodeId: rid, portIndex: 0 }, to: { nodeId: resId, portIndex: 0 } });
            });
            
            setNodes(newNodes);
            setEdges(newEdges);
        } catch (e) { console.error(e); }
    };

    // --- Render Helpers ---
    const getPortPos = (nodeId, type, index) => {
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return { x: 0, y: 0 };
        // Base dimensions must match the Node component's layout
        const baseTop = 40 + 6; 
        const gap = 12 + 12; // gap-3 is 12px (+ 12px height approx)
        const yOffset = baseTop + (index * gap);
        if (type === 'input') return { x: node.x - 12, y: node.y + yOffset };
        return { x: node.x + 192 + 12, y: node.y + yOffset };
    };

    return (
        <DashboardLayout title="Visual Policy Architect">
            <div className="flex h-[calc(100vh-140px)] gap-4 overflow-hidden">
                <div className="w-48 bg-white dark:bg-dark-card border border-slate-200 dark:border-slate-700 rounded-xl flex flex-col shrink-0 z-20 shadow-xl">
                    <div className="p-3 border-b border-slate-200 dark:border-slate-700 font-semibold text-sm">Nodes</div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                        {Object.keys(NODE_TYPES).map(key => {
                            if (key === 'RESULT') return null;
                            const type = NODE_TYPES[key];
                            return <div key={key} onClick={() => addNode(key)} className={`p-2 rounded cursor-pointer text-white text-xs font-bold shadow-sm hover:brightness-110 active:scale-95 transition-all ${type.color}`}>{type.label}</div>
                        })}
                        <div onClick={() => addNode('RESULT')} className="p-2 rounded cursor-pointer text-white text-xs font-bold shadow-sm hover:brightness-110 active:scale-95 transition-all bg-rose-600 mt-4">+ Policy Output</div>
                    </div>
                </div>

                <div className="flex-1 relative overflow-hidden bg-slate-100 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700"
                     ref={canvasRef}
                     onWheel={handleWheel}
                     onMouseDown={handleCanvasMouseDown}
                     onMouseMove={handleMouseMove}
                     onMouseUp={handleMouseUp}
                >
                    {/* Viewport Control Info */}
                    <div className="absolute top-4 right-4 z-20 flex gap-2 bg-white/80 dark:bg-slate-800/80 p-2 rounded-lg backdrop-blur-sm border border-slate-200 dark:border-slate-600">
                        <ZoomIn size={16} className="cursor-pointer hover:text-indigo-500" onClick={() => setViewport(v => ({...v, zoom: Math.min(v.zoom + 0.1, 3)}))} />
                        <span className="text-xs font-mono w-12 text-center">{(viewport.zoom * 100).toFixed(0)}%</span>
                        <ZoomOut size={16} className="cursor-pointer hover:text-indigo-500" onClick={() => setViewport(v => ({...v, zoom: Math.max(v.zoom - 0.1, 0.1)}))} />
                    </div>

                    {/* Transform Container */}
                    <div 
                        style={{ 
                            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
                            transformOrigin: '0 0',
                            width: '100%', height: '100%'
                        }}
                    >
                        {/* Grid */}
                        <div className="absolute inset-[-4000px] pointer-events-none opacity-20"
                             style={{ 
                                 backgroundImage: 'radial-gradient(#64748b 1px, transparent 1px)', 
                                 backgroundSize: '20px 20px' 
                             }}
                        />

                        {/* Edges */}
                        <svg className="absolute inset-[-4000px] w-[8000px] h-[8000px] pointer-events-none overflow-visible">
                            <defs>
                                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                                    <polygon points="0 0, 10 3.5, 0 7" fill="#64748b" />
                                </marker>
                            </defs>
                            {edges.map(edge => {
                                const start = getPortPos(edge.from.nodeId, 'output', edge.from.portIndex);
                                const end = getPortPos(edge.to.nodeId, 'input', edge.to.portIndex);
                                const cp1x = start.x + Math.abs(end.x - start.x) * 0.5;
                                const cp2x = end.x - Math.abs(end.x - start.x) * 0.5;
                                return <path key={edge.id} d={`M ${start.x} ${start.y} C ${cp1x} ${start.y}, ${cp2x} ${end.y}, ${end.x} ${end.y}`}
                                            stroke="#64748b" strokeWidth="3" fill="none" markerEnd="url(#arrowhead)" />;
                            })}
                            {connectionStart && (
                                <path d={`M ${connectionStart.startX} ${connectionStart.startY} 
                                          C ${connectionStart.startX + 50} ${connectionStart.startY}, ${mousePos.x - 50} ${mousePos.y}, ${mousePos.x} ${mousePos.y}`}
                                      stroke="#f59e0b" strokeWidth="2" strokeDasharray="5,5" fill="none" />
                            )}
                        </svg>

                        {/* Nodes */}
                        {nodes.map(node => (
                            <Node 
                                key={node.id} 
                                node={node} 
                                isSelected={false}
                                onMouseDown={handleMouseDownNode}
                                onDelete={deleteNode}
                                updateNodeData={updateNodeData}
                            />
                        ))}
                    </div>
                </div>

                <div className="w-80 bg-white dark:bg-dark-card border border-slate-200 dark:border-slate-700 rounded-xl flex flex-col shrink-0 z-20 shadow-xl">
                    <div className="p-3 border-b border-slate-200 dark:border-slate-700 font-semibold text-sm flex justify-between items-center">
                        <span>Result JSON</span>
                        <Code size={16} className="text-slate-400" />
                    </div>
                    <div className="flex-1 bg-slate-50 dark:bg-slate-900 p-0 relative group">
                        <textarea 
                            className="w-full h-full bg-transparent p-4 font-mono text-[10px] resize-none focus:outline-none dark:text-emerald-400 text-slate-700"
                            value={JSON.stringify(generatedJson, null, 2)}
                            onChange={(e) => {
                                try { setGeneratedJson(JSON.parse(e.target.value)); } catch(err) {} 
                            }}
                        />
                        <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => importJSON(JSON.stringify(generatedJson))}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded text-xs shadow-lg flex items-center gap-2"> 
                                <ArrowRight size={12} /> Sync
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default VisualScripting;
