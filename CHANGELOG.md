# Changelog

## 3.0
+ **Breaking:** Rename `SourceUpdates` to `TextReplacements`.
+ **Breaking:** Rewrite source interface to support different types of content.
+ **Breaking:** Directly export `filenameToSourceId` and `sourceIdToFilename`.
+ **Breaking:** Replace translation data handling and related api with data adapters.
+ **Breaking:** Replace strings with Buffers in plugin api.
+ **Breaking:** Remove language server and related api.
+ **Breaking:** Remove `onDiagnostics` project watch option.
+ **Breaking:** Replace `DiscardObsoleteFragmentType` with union type.
+ **Breaking:** Remove file system abstraction.

## 2.2
+ Add project update causes to language server.

## 2.1
+ Add `setLocale` hooks.

## 2.0
+ **Breaking:** Drop support for V1 manifests.
+ Implement V2 manifests with support for multiple namespaces per file.

## 1.18
+ Add namespace to manifest file info.
+ Add utility for resolving manifests.

## 1.17
+ Add utility for converting translation data values to raw locale data values.

## 1.16
+ Expose internal translation data view utility.

## 1.15
+ Add stable `Context.T` type for translation functions.
+ Fix interpolation processor syntax errors on iOS mobile devices.
+ Fix broken config parser when no plugins are configured.
+ Drop support for nodejs 15 or lower.

## 1.14
+ Add `onFinish` project watch option.
+ Deprecate `onDiagnostics` project watch option.

## 1.13
+ Add customizable defaults to config parser.

## 1.12
+ Project onDiagnostics handler can now return a promise.
+ Add output manifest generation.

## 1.11
+ Add `FetchClient` cache.
+ Fix `Controller.setLocale` and `.setLocaleAuto` behavior.
+ Discard all obsolete fragments by default.

## 1.10
+ Language server:
  + Backup and restore pending changes.
  + Emit project update when changes are saved or discarded.
  + Fix residual file diagnostics.
  + Ignore file system overwrites that are out of scope.

## 1.9
+ Add language server translation data editing capability.

## 1.8
+ Add u27n language server.

## 1.7
+ Add file system watcher delays.
+ Add config option to control obsolete fragment discarding.

## 1.6
+ Add diagnostics: `valueTypeMismatch`, `pluralFormCountMismatch`, `unsupportedLocales`
+ Add plural info module.

## 1.5
+ Add runtime translation context.

## 1.4
+ Experimental runtime api.

## 1.3
+ Translation data is now sorted by default.

## 1.2
+ Add utility for updating sources.

## 1.1
+ Add optional type param for fragments to source class.
