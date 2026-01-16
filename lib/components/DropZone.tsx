import { useDrop, DropTargetMonitor, DragObjectWithType } from 'react-dnd';
import { DragItem, DragItemType, GlyphTheme, defaultTheme } from '../types';

export interface DropZoneProps {
    /** Item types this zone accepts */
    acceptTypes: DragItemType[];
    /** Called when a valid item is dropped */
    onDrop: (item: DragItem) => void;
    /** Optional validator - return false to reject the drop */
    canDrop?: (item: DragItem) => boolean;
    /** Label shown in the drop zone */
    label: string;
    /** Optional description shown below label */
    description?: string;
    /** Theme for styling */
    theme?: GlyphTheme;
    /** Custom className */
    className?: string;
    /** Custom styles */
    style?: React.CSSProperties;
}

/**
 * Map from Glyph's DragItemType to the actual drag type strings used by the host.
 * Superset uses: 'column', 'metric', etc. as item.type in useDrag.
 */
export const ACCEPT_TYPE_MAP: Record<DragItemType, string[]> = {
    [DragItemType.Column]: ['column', 'columnOption'],
    [DragItemType.Metric]: ['metric', 'metricOption'],
    [DragItemType.Temporal]: ['column', 'columnOption'], // temporal is a column subtype
    [DragItemType.Filter]: ['filterOption'],
};

/**
 * Convert host drag item to Glyph DragItem format.
 */
export function convertToDragItem(item: unknown): DragItem | null {
    if (!item || typeof item !== 'object') return null;

    const hostItem = item as { type?: string; value?: unknown };

    // Handle Superset's format: { type: 'column'|'metric', value: ColumnMeta|Metric }
    if (hostItem.value && typeof hostItem.value === 'object') {
        const value = hostItem.value as Record<string, unknown>;

        // Determine Glyph item type
        let dragType = DragItemType.Column;
        if (hostItem.type === 'metric' || hostItem.type === 'metricOption') {
            dragType = DragItemType.Metric;
        } else if (value.is_dttm) {
            dragType = DragItemType.Temporal;
        }

        // Get the name
        const name = (value.column_name || value.metric_name || value.label || '') as string;

        // Determine data type
        let dataType: DragItem['dataType'] = 'unknown';
        if (value.is_dttm) {
            dataType = 'temporal';
        } else if (value.type_generic !== undefined) {
            // Superset's GenericDataType enum
            const genericType = value.type_generic as number;
            if (genericType === 0) dataType = 'numeric';
            else if (genericType === 1) dataType = 'string';
            else if (genericType === 2) dataType = 'temporal';
            else if (genericType === 3) dataType = 'boolean';
        }

        return {
            type: dragType,
            name,
            dataType,
            metadata: value,
        };
    }

    return null;
}

interface CollectedProps {
    isOver: boolean;
    canDrop: boolean;
}

/**
 * A drop zone component for receiving dragged items.
 * Works with react-dnd v11 and is styled based on the Glyph theme.
 */
export function DropZone({
    acceptTypes,
    onDrop,
    canDrop: canDropValidator,
    label,
    description,
    theme = defaultTheme,
    className,
    style,
}: DropZoneProps): React.ReactElement {
    // Validate that acceptTypes is provided
    if (!acceptTypes || acceptTypes.length === 0) {
        throw new Error('DropZone: acceptTypes must be a non-empty array');
    }

    // Build list of accepted drag types
    // Map from Glyph types to react-dnd type strings
    const acceptedDragTypes = acceptTypes.flatMap(t => {
        const mapped = ACCEPT_TYPE_MAP[t];
        if (mapped && mapped.length > 0) {
            return mapped;
        }
        // Fallback: use the type value directly
        return [t];
    });

    // react-dnd requires accept to be non-empty
    const finalAccept = acceptedDragTypes.length > 0 ? acceptedDragTypes : acceptTypes;

    // react-dnd v11 API - pass object directly, not factory function
    const [{ isOver, canDrop }, dropRef] = useDrop<DragObjectWithType, void, CollectedProps>({
        accept: finalAccept,
        drop: (item: DragObjectWithType) => {
            const dragItem = convertToDragItem(item);
            if (dragItem) {
                onDrop(dragItem);
            }
        },
        canDrop: (item: DragObjectWithType) => {
            if (!canDropValidator) return true;
            const dragItem = convertToDragItem(item);
            return dragItem ? canDropValidator(dragItem) : false;
        },
        collect: (monitor: DropTargetMonitor) => ({
            isOver: monitor.isOver(),
            canDrop: monitor.canDrop(),
        }),
    });

    // Determine visual state
    const isActive = isOver && canDrop;
    const isRejected = isOver && !canDrop;

    // Build styles
    const baseStyle: React.CSSProperties = {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        borderRadius: '8px',
        border: `2px dashed ${theme.colors.border}`,
        backgroundColor: theme.colors.background,
        color: theme.colors.text,
        fontFamily: theme.fontFamily,
        transition: 'all 0.2s ease',
        cursor: 'default',
        minHeight: '80px',
        ...style,
    };

    if (isActive) {
        baseStyle.borderColor = '#52c41a'; // green
        baseStyle.backgroundColor = 'rgba(82, 196, 26, 0.1)';
        baseStyle.transform = 'scale(1.02)';
    } else if (isRejected) {
        baseStyle.borderColor = '#ff4d4f'; // red
        baseStyle.backgroundColor = 'rgba(255, 77, 79, 0.1)';
    } else if (isOver) {
        baseStyle.borderColor = theme.colors.text;
    }

    return (
        <div
            ref={dropRef}
            className={className}
            style={baseStyle}
        >
            <div style={{
                fontSize: '14px',
                fontWeight: 500,
                marginBottom: description ? '4px' : 0,
                opacity: isActive ? 1 : 0.7,
            }}>
                {isActive ? 'Release to drop' : label}
            </div>
            {description && !isActive && (
                <div style={{
                    fontSize: '12px',
                    opacity: 0.5,
                }}>
                    {description}
                </div>
            )}
        </div>
    );
}
