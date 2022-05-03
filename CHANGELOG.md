# Changelog

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
