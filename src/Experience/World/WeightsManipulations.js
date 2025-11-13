this.animation.play('Walk_F_IP', 1.2)
this.animation.play('Idle_Breathe', 0.8)

function updateFade(delta) {
    const fade = this.animation.fade
    if (!fade) return

    fade.elapsed += delta
    const t = Math.min(fade.elapsed / fade.duration, 1)

    const smoothT = THREE.MathUtils.smoothstep(t, 0, 1)

    if (fade.from) fade.from.setEffectiveWeight(1 - smoothT)
    fade.to.setEffectiveWeight(smoothT)

    if (t >= 1) {
        if (fade.from) fade.from.stop()
        this.animation.fade = null
    }
}

function setAnimation() {
    this.animation = {}
    this.animation.mixer = new THREE.AnimationMixer(this.model)
    this.animation.actions = {}
    this.animation.fade = null // store fade state

    for (const name of RAW_NAMES) {
        const clip = this.resource.animations[RAW_NAMES.indexOf(name)]
        const action = this.animation.mixer.clipAction(clip)
        action.enabled = true
        action.setEffectiveWeight(0)
        action.setLoop(THREE.LoopRepeat)
        action.clampWhenFinished = true
        this.animation.actions[name] = action
    }

    // --- Manual blend logic ---
    this.animation.play = (name, fadeDuration = 0.6) => {
        const newAction = this.animation.actions[name]
        const oldAction = this.animation.actions.current
        if (!newAction || newAction === oldAction) return

        // Start both actions
        newAction.reset().play()
        if (oldAction) oldAction.play()

        // Initialize fade tracking
        this.animation.fade = {
            from: oldAction,
            to: newAction,
            duration: fadeDuration,
            elapsed: 0,
        }

        // Set initial weights
        if (oldAction) oldAction.setEffectiveWeight(1)
        newAction.setEffectiveWeight(0)

        this.animation.actions.current = newAction
    }

    // Default idle start
    const idle = this.idleAnimations[0]
    const idleAction = this.animation.actions[idle]
    idleAction.play()
    idleAction.setEffectiveWeight(1)
    this.animation.actions.current = idleAction
}

// call in update
updateFade(delta)



