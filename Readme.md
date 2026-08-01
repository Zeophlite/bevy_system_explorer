# System Explorer for Bevy

*Repository:* https://github.com/Zeophlite/bevy_system_explorer

## Usage

In Bevy `App`, add `RemotePlugin` and `RemoteHttpPlugin` .

Run this with:

```sh
npm install

npm run dev:mock   # tiny example - same as `npm run dev`
npm run dev:read   # reads from local files
npm run dev:remote # connects to locally running Bevy instance
```

## Bevy Remote Protocol

Relies on `schedule.list` and `schedule.graph` endpoints in Bevy's `main` branch.

```sh
# Terminal 1 (for `npm run dev:remote` )
cargo run --example server --features="bevy_remote" 

# Terminal 2 (for `npm run dev:read` )
cd src/data/
./get_all.sh
```

## Design

There are 3 graphs shown:

- components
- schedules
- systems

Nodes in each graph can be selected, which focuses the other graphs.

### Components Graph

Nodes are `Component`'s, and have edges towards required components.

Some required components are not shown due to their high degree of usage:

- IsResource
- Transform
- SyncToRenderWorld
- Node
- Visibility
- VisibilityClass

Components without any requirements are hidden from the graph, and in the multi-select.

If components are selected, the schedule and system graphs focuses to those that involve the component.

### Schedule

Displays nodes for each `Schedule` and edges are execution order.

Selecting a schedule will focus the components where that schedule is found, and show the systems of that schedule.

### System

Displays nodes for each `System` and `SystemSet`.

Blue edges are dependency.

Red edges are hierarchy.

Selecting a system will focus the schedule, and the components accessed by that system.

## Limitations

- Does not include State Transition schedules
