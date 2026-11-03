# Changelog

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
