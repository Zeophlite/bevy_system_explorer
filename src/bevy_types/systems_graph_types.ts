
export interface ScheduleList {
    jsonrpc: string,
    id: number | string,
    result: {
        empty_schedule_labels: string[],
        schedule_labels: string[],
        unavailable_schedule_labels: string[],
    }
}

export interface ScheduleGraph {
    jsonrpc: string,
    id: number | string,
    result: {
        schedule_data: {
            components: Component[],
            conflicts: Conflict[],
            dependency: Dependency[]
            hierarchy: Hierarchy[]
            name: string,
            system_sets: SystemSet[]
            systems: System[]
        }
    }
}

interface Component {
    name: string,
    required: number[],
}
interface Conflict {
    system_1: number,
    system_2: number,
    conflicting_access: AccessConflict,
}

type AccessConflict = never
    /// There is a conflict on the **whole world**, since one of the systems requires world access
    /// and the other needs mutable access to (some of) the world.
    | "World"
    /// There is incompatible accesses to the listed components.
    | { Components: number[] };

interface SystemWrap {
    System: number
}
interface SystemSetWrap {
    SystemSet: number
}
export type SystemOrSetWrap = SystemWrap | SystemSetWrap;

type Dependency = [SystemOrSetWrap, SystemOrSetWrap];


type Hierarchy = [number, SystemOrSetWrap];

interface ConditionData {
    name: string,
}

export interface SystemSet {
    conditions: ConditionData[],
    name: string
}

export interface System {
    apply_deferred: boolean,
    deferred: boolean,
    exclusive: boolean,
    name: string,
    filtered_accesses: FilteredAccess[],
}

interface AccessData {
    archetypal: number[],
    read_and_writes: number[],
    read_and_writes_inverted: boolean,
    writes: number[],
    writes_inverted: boolean,
}

interface FilteredAccess {
    access: AccessData,
    filter_sets: AccessFilters[],
    required: number[],
}

interface AccessFilters {
    with: number[],
    without: number[],
}
