<img src="logo/banner.png" alt="Surviv Reloaded">
<hr>
Surviv Reloaded is an open-source server for the online game surviv.io. Work in progress.<br><br>

## Join the Discord!

https://discord.gg/K97hwBtwdm

## FAQ

### Is this a surviv.io clone?
No. It's an open-source server hosting the original client. In other words, it's the original surviv.io, just hosted by a different, open-source server.

### Why this project?
I have played surviv.io since 2020, the year it was acquired by Kongregate. This is when it began to die. Unlike the original developers, Kongregate put little thought into the game itself, instead filling it with useless microtransactions. Their efforts to combat hackers with the prestige system were largely unsuccessful. As a result, fewer and fewer people played the game every day.


On February 13, 2023, Kongregate announced that they were shutting down surviv.io. I started this project to preserve it. When the original site is shut down, I will publish all of its assets here, so people can continue to enjoy the game.


A similar project to this one already exists: [Open Surviv.io](https://github.com/North-West-Wind/opensurviv-server), which is essentially an open source surviv.io clone. It's a great project, but to me, it's just not the same. I want to preserve the original game as much as possible.

## Try it out!

### Step 1: Clone the repo

[Click here to download](https://gitlab.com/hasanger/survivreloaded/-/archive/main/survivreloaded-main.zip). Extract the zip. When I say "repo folder" later in the tutorial, I'm referring to the folder you just extracted.

### Step 2: Download and patch the client

To connect to the server, you will need a modified version of the surviv.io client. When the original site shuts down, I will upload the modified client to this repo.

For now, to download the client for yourself, you can use a resource extractor like [Save All Resources](https://chrome.google.com/webstore/detail/save-all-resources/abpdnfjocnmdomablahdcfnoggeeiedb). Visit https://surviv.io, open the developer tools with Ctrl+Shift+I or F12, and click on the "ResourcesSaver" tab. Play a few games in various game modes, then click on "Save All Resources".

Alternatively, I have included a list of URLs under `reference/urls.txt`. You could write a simple script to download all of the files in said list, or use an existing tool.

Whichever method you choose, put the extracted files under `/public` in the repo folder. If you did it right, `index.html` should be here: `survivreloaded-main/public/index.html`

The modification that needs to be made to the client is very simple. Open `js/app.<some hex digits>.js` in your favorite text editor. Replace (Ctrl+H) all occurrences of `wss:` with `ws:`. This will allow the client to connect to insecure WebSocket servers.

### Step 3: Run the server

To run the server, a modern version of Node.js is required ([click here to download](https://nodejs.org/en/download/)). Open a terminal or command prompt in the repo folder, and run the following commands:

```
npm install
npm start
```

To open the game, go to http://0.0.0.0:8000 in your browser.
