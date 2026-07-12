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
