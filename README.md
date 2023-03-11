<img src="logo/banner.png" alt="Surviv Reloaded">
<hr>
Surviv Reloaded is an open-source server for the defunct online game surviv.io. Work in progress.<br><br>

## Try it out!

https://survivreloaded.com

## Join the Discord!

https://discord.survivreloaded.com

## Install it

### Step 1: Install Node.js and Git

Node.js: https://nodejs.org/

Git: https://git-scm.com/downloads


### Step 2: Clone the repo

[Click here to download](https://github.com/SurvivReloaded/survivreloaded-server/archive/refs/heads/main.zip). Extract the zip.


### Step 3: Set up the server

Open a terminal or command prompt in the extracted folder, and run the following commands:

```
git clone https://github.com/SurvivReloaded/survivreloaded-client.git public
npm install
npm run build
```

### Step 4: Start the server

To start the server, run this command:
```
npm start
```

To open the game, go to http://127.0.0.1:8000 in your browser.

If you made any changes to the code, type `npm run build` first, then `npm start`.


## FAQ

### Is this a surviv.io clone?
No. It's an open-source server hosting the original client. In other words, it's the original surviv.io, just hosted by a different server.

### Why this project?
I created Surviv Reloaded to preserve surviv.io after its shutdown.

I've played surviv.io since 2020, around the time it was acquired by Kongregate. This is when it began to die. Unlike the original developers, Kongregate put little thought into the game itself, instead filling it with useless microtransactions. Their efforts to combat hackers with the prestige system were largely unsuccessful. As a result, fewer and fewer people played the game every day.

On February 13, 2023, Kongregate announced that they were shutting down surviv.io.

On March 2, 2023, the SSL certificates for the game servers expired, essentially shutting the game down. It's still possible to join by changing your computer's time to before March 2, but the game is pretty much dead at this point.

A similar project to this one already exists: [Open Surviv.io](https://github.com/North-West-Wind/opensurviv-server), which is essentially an open source surviv.io clone. It's a great project, but to me, it's just not the same. I want to preserve the original game as much as possible.
