---
title: Add a custom API server to the Vite dev server
description: How to add a custom server, to host an API for example, on the same origin as your Vite dev server easily
pubDate: 2025-12-05
category: web
---

I'm a big fan of Bun, especially their embedded server `Bun.serve`. Being integrated in their standard library, it feels native and simple, without the need to install any dependency. I really like to create simple API servers with it.

While developping an SPA with Vite and Tanstack Router, I wanted to add an API server, and wanted to use Bun. I know Tanstack Start is supposed to bridge the gap between Vite and having a server, but it felt quite over complicated for my use case. I stumbled upon some bugs, especially with the `vite-plugin-pwa`. The SPA mode of Tanstack Start (because in the end, I want the build to be static) feels also quite secondary. It's after all quite normal as this framework is supposed to bring server capabilities to Tanstack Router.

I therefore decided to create a simple `src/server.ts` that host my API. It will serve the `dist/` folder for production, but that's optional here. This server listen on `http://localhost:3000`.

## CORS and Cookies problems

In development, the Vite Dev Server listens on `http://localhost:5173`, which means that the SPA will be on a different origin that the API. This has several drawbacks:

- CORS needs to be configured on the server. It's not a pain in itself, but we usually expedite this step by putting `*` in allowed origins, opening issues that we are not aware of.
- Cookies, especially auth ones, can't be configured with `Samesite=None` (allowing an HTTP request cross-origin) without `Secure` (needing HTTPS). Developing locally with HTTPS is a bit cumbersome as well.

Because of those issues I prefer to keep in simple projects the API on the same origin as the server serving the SPA. In production it can be done via multiple ways, but in development we need to rely on the Vite Dev Server for this.

## Vite Dev Server customization

### Adding a proxy

Thanksfully, the Vite Dev Server integrates `http-proxy`, a famous Node library that implements a transparent HTTP proxy. We can configure it easily in the `vite.config.ts`:

```ts
export default defineConfig({
  ...
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
```

The `changeOrigin` is quite important if your server implements that checks the `Origin` header against a whitelist. This is usually the case for auth libraries, like `better-auth` that I use frequently.

This will make `http://localhost:5173/api` target our Bun (or other) server, removing any CORS, Cookie or origin issue.

### Starting the server with the dev server

To improve the developer experience, it would be preferable to also start the API server alongside the Vite Dev Server. I therefore used a small Vite plugin to start up the server in background, in `hot-reloading`:

```ts
const bunServerPlugin = {
  name: "bun-server-plugin",
  configureServer(server: ViteDevServer) {
    const startBunServer = () => {
      const process = spawn("bun", ["--hot", "src/server.ts"], {
        stdio: "inherit",
        shell: true,
      });
      process.on("error", (err) => {
        console.error("Failed to start Bun server:", err);
      });
    };

    server.httpServer?.once("listening", startBunServer);
  },
};
```

It can be added like this:

```ts
export default defineConfig({
  plugins: [
    bunServerPlugin,
    ...
  ],
  ...
});
```

This way, starting the Vite Dev Server with `vite` (usually `npm run dev`) will start the server in background. As the process is a child process, quitting the Vite Dev Server will also kill this server.

## Conclusion

This method is not perfect for sure, but it's a simple way to host a server alongside the Vite Dev Server on the same origin, removing a lot of potential problemes easily. I've seen myself using it more that I thought and this it's a great way to keep thing simple in a project that we don't want to over complexify.
