# System Explorer for Bevy

*Repository:* https://github.com/Zeophlite/bevy_system_explorer

*Live:* https://zeophlite.github.io/bevy_system_explorer/

## Usage

Run this with:

```sh
npm install

npm run dev:mock   # tiny example - same as `npm run dev`
npm run dev:read   # reads from local files
npm run dev:remote # connects to locally running Bevy instance
```

## Bevy Remote Protocol

Relies on `schedule.list` and `schedule.graph` endpoints in Bevy's `main` branch.

The easiest way to start Bevy with this command, and then run `npm run dev:remote`

```sh
# Terminal 1
cargo run --example server --features="bevy_remote" 
```

You can also write the schedule graphs to file with this command, and then run `npm run dev:read`

```sh
# Terminal 2
cd src/data/
./get_all.sh
```

To get your Bevy `App` to work with `npm run dev:remote` , add `RemotePlugin` and `RemoteHttpPlugin` to your `App` .

## Design

There are 3 graphs shown:

- components
- schedules
- systems

Nodes in each graph can be selected, which focuses the other graphs.

### Components Graph

Nodes are `Component`'s, and have edges towards required components.

Some required components are not shown due to their high degree of usage:

- `IsResource`
- `Transform`
- `SyncToRenderWorld`
- `Node`
- `Visibility`
- `VisibilityClass`

Components without any requirements are hidden from the graph, and in the multi-select (TODO).

If components are selected, the schedule and system graphs focuses to those that involve the component.

### Schedule

Displays nodes for each `Schedule` and edges are execution order.

Selecting a schedule will focus the components where that schedule is found, and show the systems of that schedule.

### System

Displays nodes for each `System` (blue) and `SystemSet` (green).  Each `System` also has a corresponding `SystemSet`.

Blue edges are dependency.

Red edges are hierarchy.

Selecting a system will focus the schedule, and the components accessed by that system.

## Limitations

- Does not include State Transition schedules (e.g. `OnEnter(MyState)` )
