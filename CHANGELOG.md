# Changelog

## 1.0.0 (2026-04-28)


### Features

* add aimo init with starter yaml and e2e tests ([edbd7f6](https://github.com/agjs/aimo/commit/edbd7f63094a4e89e1ce88e1b1557237cff6225a))
* add chat ports, fake provider, and aimo ping ([7708486](https://github.com/agjs/aimo/commit/77084863158701fa345f8f86124b45ec9e7df47d))
* add config schema and yaml loader ([eafd7da](https://github.com/agjs/aimo/commit/eafd7daf49ec9f7b472ec982fab9741994592a70))
* add doctor command and config e2e tests ([0e3c842](https://github.com/agjs/aimo/commit/0e3c8422140aad7e6b57dea3c8abe9b04ac95f9f))
* **cli:** add aimo execute for delegated profiles (A6) ([ec6cd25](https://github.com/agjs/aimo/commit/ec6cd254a0fa87cf35400d0f1f974dd1f9a761e4))
* **cli:** add aimo plan with run artifacts and tests ([c12b2f0](https://github.com/agjs/aimo/commit/c12b2f0ef0da21e72846ab4ab0a5199252960d12))
* **cli:** add aimo review (A7) and stabilize git e2e fixtures ([65f201f](https://github.com/agjs/aimo/commit/65f201fb1d3c6e79c4518c1abe4aad12dc26192b))
* **cli:** aimo run with --dry-run (A8) ([49998ae](https://github.com/agjs/aimo/commit/49998aeb7b37fcefe172ce33b92effe165d7e451))
* core contracts, clock port, cleanup registry, wiring ([3227fc1](https://github.com/agjs/aimo/commit/3227fc12f6adab4820e640386a435586498205a5))
* env precedence, dotenv parse, and runtime loader ([b63bed1](https://github.com/agjs/aimo/commit/b63bed1b2f761d07961ca1a11050b0b882a4f7bb))
* **release:** bun-compile binaries + install script ([b4bc2e0](https://github.com/agjs/aimo/commit/b4bc2e01881a2b2d4ebc31e75354296ace4b9c02))
* **run:** colored stderr progress + split runPipeline dirs ([99851cb](https://github.com/agjs/aimo/commit/99851cb2e9df26e353667f7051a1cf99c1b6c60a))
* **workers:** cheap shrinkers + OpenAI-compat chat ([144c8ef](https://github.com/agjs/aimo/commit/144c8ef63fac4c972a64be5763d88e554071e5c5))


### Bug Fixes

* **ci:** core purity grep, local check parity, test work dir ([f7819f5](https://github.com/agjs/aimo/commit/f7819f5dda7df7d21b44418380f1484d2951c4ff))
* **cli:** drop unreachable return after process.exit ([f34c760](https://github.com/agjs/aimo/commit/f34c76016676c6d49e9f22e55c88380b1c05085c))
* correct setup-bun pin and core purity grep false positives ([b9b4441](https://github.com/agjs/aimo/commit/b9b44415dae69599d05e562f8c570b8370bffa3f))
* release-please GITHUB_TOKEN permissions ([dcb54db](https://github.com/agjs/aimo/commit/dcb54db3662f35e032f45549dc9cfbb1b868d843))
* scorecard action SHA and gate pushes with husky check ([2736c4a](https://github.com/agjs/aimo/commit/2736c4afe0cd19f0a0aa7dd3e076792ac86f4675))


### Refactoring

* **app:** modular run pipeline, stylistic padding, CLI fixes ([61a7c63](https://github.com/agjs/aimo/commit/61a7c630cb219eb0653b8a9bb05da35245927af3))
