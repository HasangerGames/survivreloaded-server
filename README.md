<img src="logo/surviv.png">
<h1>SURVIV RELOADED</h1>

An open-source server for the online game surviv.io. Work in progress.

## Why this project?
I have played surviv.io since 2020, the year it was acquired by Kongregate. Since then, the game has been dying slowly. Unlike the original developers, Kongregate have put little thought into the game itself, instead filling it with useless microtransactions. Their efforts to combat hackers with the prestige system have been largely unsuccessful. As a result, fewer and fewer people play the game every day.


With the recent decision to rotate Seasons, it seems like Kongregate has abandoned the game entirely. I'm afraid that when the user count drops too low, the site will be shut down. I started this project to preserve it. When and if the original site is shut down permanently, I will publish all of its assets here, so people can continue to enjoy the game.


A similar project to this one already exists: [Open Surviv.io](https://github.com/North-West-Wind/opensurviv-server), which is essentially an open source surviv.io clone. It's a great project, but to me, it's just not the same. I want to preserve the original game as much as possible.

## Setup
To connect to the server, you will need a modified version of the surviv.io client. For copyright reasons, I have not uploaded it to this repository. In the future, I will write a program that automatically downloads and patches the client.

For now, to download the client for yourself, you can use a resource extractor like [Save All Resources](https://chrome.google.com/webstore/detail/save-all-resources/abpdnfjocnmdomablahdcfnoggeeiedb). Visit https://surviv.io, open the developer tools, and select the Save all Resources tab. Play a few games in various game modes, and the extension should download most of the required files.

Alternatively, I have included a list of URLs under `reference/urls.txt`. You could write a simple script to download all of the files in said list, or use an existing tool. 

The modification that needs to be made to the client is very simple. In the extracted files, go to `js/app.<some hex digits>.js`. Replace all occurrences of `wss:` with `ws:`. This will allow the client to connect to insecure WebSocket servers.

At the moment, the program also relies on a Java-based server, which hosts the client. The Java server recreates the surviv.io API, and tells the client to connect to this custom server, instead of the official surviv.io servers. The Java server will be rewritten in JS and merged with this one shortly.

## Run the server
A modern version of Node.js is required.

```
npm install
npm run setup
npm start
```
