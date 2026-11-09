# Changelog

## [0.4.0](https://github.com/TomokiMiyauci/whitebox/compare/v0.3.0...v0.4.0) (2026-11-09)


### ⚠ BREAKING CHANGES

* export Signal API from submodule ([#19](https://github.com/TomokiMiyauci/whitebox/issues/19))


### Bug Fixes

* enhance effect handling and scheduling ([#14](https://github.com/TomokiMiyauci/whitebox/issues/14)) ([f178f93](https://github.com/TomokiMiyauci/whitebox/commit/f178f93f2456d39708dbecb3a1263d7025ee4576))

## [0.3.0](https://github.com/TomokiMiyauci/whitebox/compare/v0.2.0...v0.3.0) (2026-11-07)


### ⚠ BREAKING CHANGES

* change signal API to strict proposal.
* update currentComputed function to return null instead of undefined
* rename signal option interface
* remove Action interface from public API
* remove un-official API from signal
* switch to proposal signal implement, remove Effect from public API

### Features

* add bim dependency and refactor signal implementation ([237251e](https://github.com/TomokiMiyauci/whitebox/commit/237251ea8dad28cfe49e6a8ad053e53a32810bd6))
* change signal API to strict proposal. ([c88f254](https://github.com/TomokiMiyauci/whitebox/commit/c88f2547e689cb3e2553d3a77b70cddfe0ffaf38))
* refine Signal interface and update related types for better clarity ([47805a8](https://github.com/TomokiMiyauci/whitebox/commit/47805a80746c6f22b17ee0f68210eb8d0306249b))
* remove Action interface from public API ([bddd07c](https://github.com/TomokiMiyauci/whitebox/commit/bddd07c651d5ce31bddfafa1a09f73906d88eb2f))
* remove un-official API from signal ([1da16f4](https://github.com/TomokiMiyauci/whitebox/commit/1da16f4a3242004fca8a1230dac584b5d066d82a))
* rename signal option interface ([619729b](https://github.com/TomokiMiyauci/whitebox/commit/619729b2874ce693626a471487a61e78f53e4d42))
* switch to proposal signal implement, remove Effect from public API ([78d9d33](https://github.com/TomokiMiyauci/whitebox/commit/78d9d3352937f718f0edc7fe4d8270d1b2702399))
* update currentComputed function to return null instead of undefined ([1eeb2a4](https://github.com/TomokiMiyauci/whitebox/commit/1eeb2a480f4ae8ccf05ff04aca21d376c6164815))


### Bug Fixes

* add error handling for invalid sink in toPublicSink function ([ab9dea9](https://github.com/TomokiMiyauci/whitebox/commit/ab9dea959b4a86b9e5309ccb94de868a9825d518))

## [0.2.0](https://github.com/TomokiMiyauci/whitebox/compare/v0.1.0...v0.2.0) (2026-11-04)


### ⚠ BREAKING CHANGES

* change effect decorator interface to accept cleanup callback at first argument
* remove run method from Effect constructor, run on construction

### Features

* add clean up callback to action argument ([a2cdc4d](https://github.com/TomokiMiyauci/whitebox/commit/a2cdc4dec60d85bf2cf25292a5203c35b261783a))
* change effect decorator interface to accept cleanup callback at first argument ([2e7664f](https://github.com/TomokiMiyauci/whitebox/commit/2e7664fea33f2140cdd92b95fa0d64acd7ba335e))
* export RegisterCleanup interface and update Action type definition ([42e521a](https://github.com/TomokiMiyauci/whitebox/commit/42e521a1cf0c4d8dd1f0c09b77d816912001837d))
* export Signal and Action types ([c340479](https://github.com/TomokiMiyauci/whitebox/commit/c340479164a0727a29cd862f55a551341da6929d))
* remove run method from Effect constructor, run on construction ([b50e043](https://github.com/TomokiMiyauci/whitebox/commit/b50e0439eb0b77d40ecada62aa1fd82dfcb35f96))


### Bug Fixes

* remove calling run method from effect instance ([bd7c191](https://github.com/TomokiMiyauci/whitebox/commit/bd7c191e7529eeb70a6b5f8fe42b8eb370f2f2a6))

## 0.1.0 (2026-11-03)


### ⚠ BREAKING CHANGES

* remove component decorator
* change reactive and attr decorators to class accessor decorator
* change effect to class decorator factory
* change return type of custom element decorator to CustomElementConstructor
* change the component model to extend a base class that provides the custom element lifecycle, instead of requiring components to extend HTMLElement directly.
* remove observe from public api
* add customElement decorator, split from component
* delete generics from component, simplify argument
* remove renderer from component API
* add renderer interface, rename template to renderer props
* change component decorator to factory, accept template function

### Features

* add customElement decorator, split from component ([b298ae7](https://github.com/TomokiMiyauci/whitebox/commit/b298ae7a87abb8d0ea1e796bda756fc1efe9a407))
* add effect decorator for reactive side effect ([4b34f1c](https://github.com/TomokiMiyauci/whitebox/commit/4b34f1c2a0748cce8ae58bb85aad32352923b9da))
* add initial implementation of reactive system with decorators and subscriptions ([02c4c04](https://github.com/TomokiMiyauci/whitebox/commit/02c4c04ae6dd0f8bd04b27646febb79d76e3a8da))
* add MicrotaskScheduler for improved task scheduling in component ([6c96390](https://github.com/TomokiMiyauci/whitebox/commit/6c96390dfa4f8bda95b880f842a271d0f2dd7f18))
* add react and preact renderer ([96b233f](https://github.com/TomokiMiyauci/whitebox/commit/96b233f8eb1478d3815ee1a1cf2fb9eeafd22e58))
* add renderer interface, rename template to renderer props ([976ef21](https://github.com/TomokiMiyauci/whitebox/commit/976ef214087ac0d407819a51fe71fa355c339aa2))
* add shadowHost decorator to attach open Shadow DOM to custom elements ([71a314c](https://github.com/TomokiMiyauci/whitebox/commit/71a314c156f05f42cfef628388623a6218cf0ec7))
* add style decorator to apply CSS stylesheets to components ([2be1630](https://github.com/TomokiMiyauci/whitebox/commit/2be16302a6f2948e127a3698bcdcc74ffcbe5bf8))
* change component decorator to factory, accept template function ([8a60167](https://github.com/TomokiMiyauci/whitebox/commit/8a60167610b09f5b91622f0ba37013b3590ca4e4))
* change effect to class decorator factory ([50312d2](https://github.com/TomokiMiyauci/whitebox/commit/50312d2891caae275b5301dfd33ee156629a95eb))
* change reactive and attr decorators to class accessor decorator ([d07e6a8](https://github.com/TomokiMiyauci/whitebox/commit/d07e6a89973a76bbd258fa765459d655cb40df95))
* change return type of custom element decorator to CustomElementConstructor ([62c1981](https://github.com/TomokiMiyauci/whitebox/commit/62c1981ea6c9c649caed1e08572caa62ca71599d))
* change the component model to extend a base class that provides the custom element lifecycle, instead of requiring components to extend HTMLElement directly. ([1c66faf](https://github.com/TomokiMiyauci/whitebox/commit/1c66fafd9de9a40ffc42bab4860f819fd7f4a4f3))
* component to be extend HTMLElement, register define custom component ([4e44433](https://github.com/TomokiMiyauci/whitebox/commit/4e444332f29655a8116ed01363d59a9184478873))
* delete generics from component, simplify argument ([3b72043](https://github.com/TomokiMiyauci/whitebox/commit/3b720438cad919c82ca21733c652cf9b53821be9))
* export Effect constructor ([7411584](https://github.com/TomokiMiyauci/whitebox/commit/741158448330b0992a1326f213a230d2d1f201a0))
* improve component decorator factory generics ([7688c0a](https://github.com/TomokiMiyauci/whitebox/commit/7688c0a86492314520538908fb57a5abd6cb6e6c))
* improve type infer with template props ([5bc3fb7](https://github.com/TomokiMiyauci/whitebox/commit/5bc3fb77fea2152b8f0f86efd81e4f9241138262))
* remove component decorator ([9a3a95d](https://github.com/TomokiMiyauci/whitebox/commit/9a3a95dc7d493a01e81d3c24e195ad762c171947))
* remove observe from public api ([c8527b5](https://github.com/TomokiMiyauci/whitebox/commit/c8527b5e2bd8690317812a9678228d5c774cc3dd))
* remove renderer from component API ([4092959](https://github.com/TomokiMiyauci/whitebox/commit/40929590acacd48c85545eae6c44c77dbad06375))
* render to shadow root if this is attached shadow root ([43ac189](https://github.com/TomokiMiyauci/whitebox/commit/43ac189c8158747cac150460d643c1a554733cd8))
* switch to using reactive system instead of pubsub ([2b87803](https://github.com/TomokiMiyauci/whitebox/commit/2b87803a3681d9d4de0ef4c4745ff4649148015f))


### Bug Fixes

* add Effect dependency update test and clear dependencies on run ([0368e2c](https://github.com/TomokiMiyauci/whitebox/commit/0368e2c30c288134863d37af19bd6ae698d143c6))
* change effect applying model, effect on construct directly ([7d53e5c](https://github.com/TomokiMiyauci/whitebox/commit/7d53e5c3152e6c7dc0f5a113c866324068a02d5f))
* handle potential null metadata in plugin retrieval ([7c1d67b](https://github.com/TomokiMiyauci/whitebox/commit/7c1d67b25c8bcaf63052f06670af075e81e6c567))
* replace getOrInsertComputed with manual set handling in subscribe method ([31672a9](https://github.com/TomokiMiyauci/whitebox/commit/31672a9244ded03f4a4a42bdfbdeb88ffd44c310))
* update Effect import and refine effect function signature ([7ad90a3](https://github.com/TomokiMiyauci/whitebox/commit/7ad90a31dc6cedd1cde699d0d3b110d669baeac0))
