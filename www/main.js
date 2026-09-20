console.log('hello world');

Neutralino.init();
Neutralino.events.on("windowClose", () => Neutralino.app.exit());
