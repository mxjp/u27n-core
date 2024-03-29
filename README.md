# U27N Core
U27N is a _universal internationalization_ framework that aims to provide an end to end solution for authoring, maintaining and shipping translations by using the following workflow:
+ Code is written in a single locale of choice.
+ U27n keeps track of all translatable text fragments by assigning project wide unique ids.
+ Translations are written in an external editor or directly in your IDE and then bundled for runtime use.

## Content
+ [Configuration](#configuration)
+ [Command Line Interface](#command-line-interface)
+ [Runtime API](#runtime-api)
  + [Controller](#controller)
  + [Context](#content)
  + [Text Fragments](#text-fragments)
    + [Interpolation & Formatting](#interpolation--formatting)
    + [Pluralization](#pluralization)
  + [Concurrent Locales](#concurrent-locales)
  + [Setting the document locale](#setting-the-document-locale)
  + [Usage with SolidJS](#usage-with-solidjs)
  + [Usage with React / Preact](#usage-with-react--preact)
+ [Toolchain API](#toolchain-api)
  + [Configuration](#configuration-1)
  + [Plugins](#plugins)
    + [Sources](#sources)
    + [Data Adapters](#data-adapters)
  + [Projects](#projects)
+ [Changelog](./CHANGELOG.md)

## Packages
+ [@u27n/typescript](https://www.npmjs.com/package/@u27n/typescript) - Plugin for handling typescript and javascript source code.
+ [@u27n/webpack](https://www.npmjs.com/package/@u27n/webpack) - Webpack plugin and runtime.

<br>



# Configuration
The configuration is stored in a file usually called **u27n.json**:
```js
{
  // Optional. The filename where to store translation data.
  // This filename may be used differently or not at all if a custom data adapter is used.
  "data": "./u27n-data.json",

  // Optional. The namespace for this project. This should be
  // a unique string such as an npm package name.
  // (Default is an empty string)
  "namespace": "",

  // Optional. An array of patterns which sources are translated.
  // Patterns should be picomatch compatible.
  "include": [
    "./src/**/*"
  ],

  // An array of locales.
  // The first locale is the one that source code is written in.
  // (Default is ["en"])
  "locales": [
    "en",
    "de"
  ],

  // An array of plugins modules:
  // (Default is [])
  "plugins": [
    // Without config:
    "@u27n/typescript",

    // Or with config:
    {
      "entry": "@u27n/typescript",
      "config": {
        // ...
      }
    }
  ],

  "obsolete": {
    // Optional. Controls what obsolete translations are discarded.
    // + "untranslated": Discard obsolete fragments that have no translations.
    // + "outdated": Discard obsolete fragments that
    //               have no or only outdated translations.
    // + "all": Discard all obsolete fragments.
    "discard": "all"
  },

  "output": {
    // Optional. The filename where to store bundled locales.
    // "[locale]" is replaced with the target locale.
    //
    // If this is set to null, no output is written.
    "filename": "./dist/locale/[locale].json",

    // Optional. If true, outdated translations are not
    // included in the locale bundles.
    "includeOutdated": false,

    // Optional. The directory where to store the output manifest.
    //
    // If this is set to null, no output manifest is written.
    "manifestPath": "./dist",
  },

  // Optional. An object to configure diagnostic severity:
  //
  // Supported severities are:
  // - "error": Show as an error. This will cause the cli process to exit with "1" when building.
  // - "warning": Show as a warning.
  // - "info": Show as information.
  // - "ignore": Ignore the diagnostic.
  //
  // By default, all diagnostics are treated as errors.
  "diagnostics": {
    // Fallback for unconfigured diagnostics:
    "*": "error",

    // Severity for specific diagnostics:
    "outdatedTranslations": "warning",
  }
}
```

# Command Line Interface
```bash
npx u27n [...options]

# Usually, one of the following commands is used:

# During development:
npx u27n --watch
# Or to run diagnostics and bundle locales:
npx u27n
```
+ `--config <filename>`: Specify the config filename.
+ `--watch`: Watch for changes during development.
+ `--no-output`: Disable writing output bundles.
+ `--modify`/`--no-modify`: Enable or disable updating source code when unique ids must be assigned or changed.
  This is automatically enabled in watch mode.
+ `--delay`: Time to wait in milliseconds after changes on disk are detected. Default is 100.

<br>



# Runtime API

## Controller
Usually, there is one controller per web application that loads and manages locale data.
```ts
import { U27N, FetchClient, defaultLocaleFactory } from "@u27n/core/runtime";

// Create a global controller:
const u27n = new U27N({
  // An array of clients that are used to load locale data:
  clients: [
    new FetchClient("/locale/[locale].json"),
  ],

  // A function that is used to create new locale instances:
  localeFactory: defaultLocaleFactory,
});

// When your application loads, detect and load the locale:
await u27n.setLocaleAuto(["en", "de"]);
```

## Context
A context provides translation functions for a specific namespace.
```ts
import { Context } from "@u27n/core/runtime";

// Create a context for the namespace "example" and source locale "en":
const context = new Context(u27n, "example", "en");

// Export the translation function for use in other modules:
export const t = context.t;
```

## Text Fragments
The **t** function of the controller is used to get a translation from the controller or just return the value if the current locale is the source locale of the context.

_Note, that fragment ids are omitted from the following code examples._
```ts
t("simple text");
```

### Interpolation & Formatting
If a `fields` object is passed, interpolation and formatting is enabled:
```ts
t("The current time is {now}", { fields: {
  now: new Date().toLocaleTimeString(u27n.locale.code),
} });
```

To automatically format values, formatters with a name or for specific value types can be registered on the controller or passed directly to the translation function:
```ts
// Register a named formatter:
u27n.formatters.set("Time", (value, locale) => {
  return value.toLocaleTimeString(locale.code);
});

// Register a formatter for a specific prototype:
u27n.formatters.set(Date, (value, locale) => {
  return value.toLocaleTimeString(locale.code);
});

// Register a formatter for a specific primitive type:
u27n.formatters.set("number", (value) => {
  return String(Math.floor(value * 100) / 100);
});

// Use a named formatter:
t("The current time is {now, Time}", { fields: { now: new Date() } });
// Or select a formatter based on the value type:
t("The current time is {now}", { fields: { now: new Date() } });
t("{value} meters", { fields: { value: 42.1234 } });
```

### Pluralization
If a `count` option is passed the correct plural form for the current locale is selected:
```ts
t(["apple", "apples"], { count: 42 });
```
Interpolation and formatting can also be used in plural values:
```ts
t(["{count} apple", "{count} apples"], { count: 42 });
```

Note, that the number and order of plural forms depends on the locale. Pluralization is supported for all locales defined in [this file](./resources/plurals.json5).

## Concurrent Locales
For things like server side rendering, it may be necessary to switch between locales depending on external factors e.g. which user makes a request. For this purpose, it is recommended to use multiple controllers in parallel and pass the translation function for the correct locale to the part of the application that needs to be translated:
```tsx
async function createLocale(locale) {
  const u27n = new U27N({
    clients: [
      new FetchClient("/locale/[locale].json"),
    ],
    localeFactory: defaultLocaleFactory,
  });
  await u27n.setLocale(locale);
  const context = new Context(u27n, "example", "en");
  return context.t;
}

// The following code shows how this setup could be used:

const locales = {
  en: await createLocale("en"),
  de: await createLocale("de"),
};

function renderPage(t) {
  return <Page>
    <h1>{t("Hello World!", "42")}</h1>
  </Page>;
}

server.onRequest(user => {
  return renderPage(locales[user.locale] ?? locales.en);
});
```

## Setting the document locale
A web page should indicate it's current language by setting the **lang** attribute.
```ts
u27n.updateHandlers.add(() => {
  document.documentElement.lang = u27n.locale?.code ?? "";
});
```

## Usage with SolidJS
```tsx
import { createSignal } from "solid-js";
import { wrapSignalT } from "@u27n/core/runtime";

// Create a signal that is updated when the locale changes:
const [useLocale, setLocale] = createSignal(u27n.locale);
u27n.updateHandlers.add(() => {
  setLocale(u27n.locale);
});

// Wrap the translation function to use the locale signal:
export const t = wrapSignalT(context.t, useLocale);

function Example() {
  return <h1>{t("Hello World!")}</h1>;
}
```

## Usage with React / Preact
```tsx
// When using react:
import { signal } from "@preact/signals-react";
// When using preact:
import { signal } from "@preact/signals";

import { wrapSignalT } from "@u27n/core/runtime";

// Create a signal that is updated when the locale changes:
const localeSignal = signal(u27n.locale);
u27n.updateHandlers.add(() => {
  localeSignal.value = u27n.locale;
});

// Wrap the translation function to use the locale signal:
export const t = wrapSignalT(context.t, () => localeSignal.value);

function Example() {
  return <h1>{t("Hello World!")}</h1>;
}
```

<br>



# Toolchain API
The toolchain API is exported by the `@u27n/core` package and can be used to implement alternatives to the command line interface such as the [@u27n/webpack](https://www.npmjs.com/package/@u27n/webpack) package.

## Configuration
```ts
import { Config } from "@u27n/core";

// Read and validate a config file:
const config = await Config.read("./u27n.json");

// Create a validated config object programmatically:
const config = await Config.fromJson({
  include: [
    "./src/**/*"
  ],
  locales: [
    "en",
    "de"
  ],
}, process.cwd());
```

## Plugins

### Sources
Plugins can be used to implement how specific source files are handled. Sources can be implemented manually or
by extending the [SourceBase](./src/source-base.ts) or [TextSource](./src/text-source.ts) classes.
```ts
import { Plugin } from "@u27n/core";

export default class ExamplePlugin implements Plugin {
  createSource(context: Plugin.CreateSourceContext) {
    if (context.filename.endsWith(".txt")) {
      // It is usually required to read the text content of the source file from disk:
      const content = await context.getTextContent();

      // The result must be an object implementing the "Source" interface or
      // undefined, to indicate that this plugin can't handle the specified file:
      return new ExampleSource(content);
    }
  }
}
```

### Data Adapters
Data adapters provide the interface between a project and the translation data storage. The [default data adapter](./src/data-adapter-default.ts) stores all translation data in a single git friendly file usually called `u27n-data.json`. Plugins have the ability to overwrite the project's data adapter during initialization.
```ts
import { Plugin } from "@u27n/core";

export default class ExamplePlugin implements Plugin {
  setup(context: Plugin.Context) {
    // "customAdapter" must be an object implementing the "DataAdapter" interface.
    context.setDataAdapter(customAdapter);
  }
}
```

## Projects
Projects provide a high level API for compiling locales, updating translation data and watching for changes.
```ts
import { Project } from "@u27n/core";

// Create a project instance:
const project = await Project.create({
  config,
  dataAdapter,
});

// Run once:
// (Diagnostics can be accessed via the result object)
const result = await project.run({
  // If true, output files are generated:
  output: true,
  // If true, sources and translation data may be modified:
  modify: false,
  // If true, additional diagnostics for data fragments are collected:
  fragmentDiagnostics: true,
});

// Run and watch for changes:
const stop = await project.watch({
  // Same options as in project.run(..) with the addition of:

  // Passed to the file system abstraction as a delay when watching for changes:
  delay: 100,

  // Called for every critical error that occurs:
  onError(error: unknown) {
    // ...
  },

  // Called when a set of changes has been processed.
  // This function may return a promise that is
  // awaited before processing further change sets.
  async onFinish(result: WatchResult) {
    // ...
  },
});

// Stop watching for changes:
await stop();
```
