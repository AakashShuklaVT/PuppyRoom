import * as THREE from 'three'
import Experience from '../Experience.js'
import { ANIMATION_NAMES as RAW_NAMES, ANIMATIONS_BY_TYPE, TURN_SIDES, FADE_PROFILES } from '../Configs/AnimationData.js'

const ROOM_DIMENSIONS = { width: 4.8, height: 4.8 }

const ANIMATIONNAMES = {
    WALK_FORWARD: 'Walk_F_IP',
    TURN_LEFT: 'Turn_L_IP',
    TURN_RIGHT: 'Turn_R_IP',
    TURN_LEFT_180: 'Turn_L180_IP',
    TURN_RIGHT_180: 'Turn_R180_IP',
}

export default class Dog {
    constructor() {
        const exp = new Experience()
        this.scene = exp.scene
        this.resources = exp.resources
        this.time = exp.time
        this.debug = exp.debug

        this.modelScaling = 1.6

        this.curve = null
        this.curveProgress = 0
        this.speed = 0.0006
        this.reached = false

        this.isTurning = false
        this.turnProgress = 0
        this.turnDuration = 2.0
        this.turnAngle = 0
        this.turnDirection = 'Straight'

        this.idleAnimations = ANIMATIONS_BY_TYPE.idle
        this.currentIdleIndex = 0

        if (this.debug.active) this.debugFolder = this.debug.ui.addFolder('dog')

        this.resource = this.resources.items.dogModel
        this.setModel()
        this.setAnimation()

        const firstIdle = this.idleAnimations[0]
        const idleAction = this.animation.actions[firstIdle]

        if (idleAction) {
            this.animation.play(firstIdle)
            setTimeout(() => this.startNewPath(), idleAction._clip.duration * 1000)
        }
        else {
            this.startNewPath()
        }
    }

    setModel() {
        this.model = this.resource.scene
        this.model.scale.set(this.modelScaling, this.modelScaling, this.modelScaling)
        this.model.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true
                child.receiveShadow = true
            }
        })
        this.scene.add(this.model)
    }

    setAnimation() {
        this.animation = {}
        this.animation.mixer = new THREE.AnimationMixer(this.model)
        this.animation.actions = {}
        this.animation.fade = null

        for (const name of RAW_NAMES) {
            const clip = this.resource.animations[RAW_NAMES.indexOf(name)]
            const action = this.animation.mixer.clipAction(clip)
            action.enabled = true
            action.setEffectiveWeight(0)
            action.setLoop(THREE.LoopRepeat)
            action.clampWhenFinished = true
            this.animation.actions[name] = action
        }

        this.animation.play = (name, fadeDuration = null, fadeProfile = null) => {
            const newAction = this.animation.actions[name]
            const oldAction = this.animation.actions.current
            if (!newAction || newAction === oldAction) return

            let transitionKey = null
            if (oldAction) {
                const from = oldAction._clip.name
                const to = newAction._clip.name

                if (from.includes('Idle') && to.includes('Turn')) transitionKey = 'IDLE_TO_TURN'
                else if (from.includes('Turn') && to.includes('Walk')) transitionKey = 'TURN_TO_WALK'
                else if (from.includes('Walk') && to.includes('Idle')) transitionKey = 'WALK_TO_IDLE'
            }

            if (transitionKey && !fadeProfile && !fadeDuration) {
                const preset = FADE_PROFILES[transitionKey]
                fadeDuration = preset.duration
                fadeProfile = preset.profile
            }

            if (!fadeDuration) fadeDuration = 0.6

            newAction.reset().play()
            if (oldAction) oldAction.play()

            this.animation.fade = {
                from: oldAction,
                to: newAction,
                duration: fadeDuration,
                elapsed: 0,
                profile: fadeProfile || null
            }

            if (oldAction) oldAction.setEffectiveWeight(1)
            newAction.setEffectiveWeight(0)

            this.animation.actions.current = newAction
            console.log(this.animation.actions.current._clip.duration, this.animation.actions.current._clip.name);
        }

        const idle = this.idleAnimations[0]
        const idleAction = this.animation.actions[idle]
        idleAction.play()
        idleAction.setEffectiveWeight(1)
        this.animation.actions.current = idleAction
    }

    generateRandomCurve() {
        const halfWidth = ROOM_DIMENSIONS.width / 2
        const halfHeight = ROOM_DIMENSIONS.height / 2
        const start = this.model.position.clone()

        const currentForward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.model.quaternion).normalize()

        let end
        let attempts = 0
        let maxAttempts = 30
        this.minDistance = 1.5
        this.minTurnAngle = 70
        this.maxTurnAngle = 135

        do {
            end = new THREE.Vector3(THREE.MathUtils.randFloat(-halfWidth, halfWidth), 0, THREE.MathUtils.randFloat(-halfHeight, halfHeight))

            const dir = new THREE.Vector3().subVectors(end, start).normalize()
            const dot = THREE.MathUtils.clamp(currentForward.dot(dir), -1, 1)
            const angleDeg = THREE.MathUtils.radToDeg(Math.acos(dot))

            if (start.distanceTo(end) >= this.minDistance && angleDeg >= this.minTurnAngle && angleDeg <= this.maxTurnAngle) break

            attempts++
        } while (attempts < maxAttempts)

        if (start.distanceTo(end) < this.minDistance) {
            const dir = currentForward
                .clone()
                .applyAxisAngle(
                    new THREE.Vector3(0, 1, 0),
                    THREE.MathUtils.degToRad(
                        THREE.MathUtils.randFloat(this.minTurnAngle, this.maxTurnAngle) *
                        (Math.random() < 0.5 ? -1 : 1)
                    )
                )
            end = start.clone().addScaledVector(dir, this.minDistance * 2)
        }

        const direction = new THREE.Vector3().subVectors(end, start).normalize()
        const distance = start.distanceTo(end)
        const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x).normalize()

        const offsetScale = Math.min(distance * 0.05, 0.2)
        const offset1 = (Math.random() - 0.5) * offsetScale
        const offset2 = (Math.random() - 0.5) * offsetScale

        const mid1 = new THREE.Vector3().lerpVectors(start, end, 0.33).addScaledVector(perpendicular, offset1)
        const mid2 = new THREE.Vector3().lerpVectors(start, end, 0.66).addScaledVector(perpendicular, offset2)

        const curve = new THREE.CatmullRomCurve3([start, mid1, mid2, end], false, 'catmullrom', 0.99)

        this.newDirection = new THREE.Vector3().subVectors(end, start).normalize()

        if (this.debug.active) {
            if (this.debugCurve) {
                this.scene.remove(this.debugCurve)
                this.debugCurve.geometry.dispose()
                this.debugCurve.material.dispose()
            }
            const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(100))
            const material = new THREE.LineBasicMaterial({ color: 0xff0000 })
            this.debugCurve = new THREE.Line(geometry, material)
            this.scene.add(this.debugCurve)
        }
        return curve
    }

    getDirectionChange(model, newTargetDirection) {
        const currentForward = new THREE.Vector3(0, 0, 1).applyQuaternion(model.quaternion).normalize()

        currentForward.y = 0
        newTargetDirection.y = 0

        currentForward.normalize()
        newTargetDirection.normalize()

        const cross = new THREE.Vector3().crossVectors(currentForward, newTargetDirection)
        const crossY = cross.y

        const dot = THREE.MathUtils.clamp(currentForward.dot(newTargetDirection), -1, 1)
        const signedAngle = Math.atan2(crossY, dot)
        const signedDeg = THREE.MathUtils.radToDeg(signedAngle)
        const angleDeg = Math.abs(signedDeg)

        let side = TURN_SIDES.STRAIGHT
        if (signedDeg > 0.001) side = TURN_SIDES.LEFT
        else if (signedDeg < -0.001) side = TURN_SIDES.RIGHT

        this.turnAngle = angleDeg
        this.turnDirection = side
    }

    startNewPath() {
        this.curve = this.generateRandomCurve()
        this.curveProgress = 0
        this.reached = false

        this.getDirectionChange(this.model, this.newDirection)

        const forward = new THREE.Vector3(0, 0, 1)
        const actualDir = this.newDirection.clone().normalize()

        let visualTurnOffsetDeg = 0
        if (this.turnDirection === TURN_SIDES.LEFT && this.turnAngle >= 40) visualTurnOffsetDeg = 60
        else if (this.turnDirection === TURN_SIDES.RIGHT && this.turnAngle >= 40) visualTurnOffsetDeg = -60

        const correctedDir = actualDir.clone()
        const correctionMatrix = new THREE.Matrix4().makeRotationY(
            THREE.MathUtils.degToRad(-visualTurnOffsetDeg)
        )
        correctedDir.applyMatrix4(correctionMatrix).normalize()

        this.startQuaternion = this.model.quaternion.clone()
        this.endQuaternion = new THREE.Quaternion().setFromUnitVectors(
            forward,
            correctedDir
        )
        this.turnProgress = 0
        this.isTurning = true

        let turnAnim = ANIMATIONNAMES.WALK_FORWARD

        if (this.turnDirection === TURN_SIDES.LEFT) {
            if (this.turnAngle < 10) turnAnim = ANIMATIONNAMES.WALK_FORWARD
            else if (this.turnAngle < 135) turnAnim = ANIMATIONNAMES.TURN_LEFT
            else turnAnim = ANIMATIONNAMES.TURN_LEFT_180
        }
        else if (this.turnDirection === TURN_SIDES.RIGHT) {
            if (this.turnAngle < 10) turnAnim = ANIMATIONNAMES.WALK_FORWARD
            else if (this.turnAngle < 135) turnAnim = ANIMATIONNAMES.TURN_RIGHT
            else turnAnim = ANIMATIONNAMES.TURN_RIGHT_180
        }

        this.animation.play(turnAnim)

        const clip = this.animation.actions[turnAnim]?._clip
        const clipDuration = clip ? clip.duration : 1.0
        const normalized = THREE.MathUtils.clamp((this.turnAngle - 10) / (135 - 10), 0, 1)
        this.turnDuration = THREE.MathUtils.lerp(clipDuration * 0.8, clipDuration * 1.2, normalized)
    }

    playSequentialIdle() {
        if (!this.idleAnimations.length) return

        const idleName = this.idleAnimations[this.currentIdleIndex]
        const idleAction = this.animation.actions[idleName]
        if (!idleAction) return

        this.animation.play(idleName)

        const duration = idleAction._clip.duration * 1000
        this.currentIdleIndex =
            (this.currentIdleIndex + 1) % this.idleAnimations.length
        setTimeout(() => this.startNewPath(), duration)
    }

    updateFade(delta) {
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

    update() {
        this.animation.mixer.update(this.time.delta * 0.001)
        this.updateFade(this.time.delta * 0.001)

        if (this.isTurning) {
            this.turnProgress += this.time.delta / 1000 / this.turnDuration
            if (this.turnProgress >= 1) {
                this.turnProgress = 1
                this.isTurning = false
                this.animation.play(ANIMATIONNAMES.WALK_FORWARD)
            }

            this.model.quaternion.slerpQuaternions(
                this.startQuaternion,
                this.endQuaternion,
                THREE.MathUtils.smoothstep(this.turnProgress, 0, 1)
            )
            return
        }

        if (!this.curve) return
        const totalLength = this.curve.getLength()
        const distancePerFrame = this.speed * this.time.delta
        const currentDistance = THREE.MathUtils.clamp(
            this.curveProgress * totalLength + distancePerFrame,
            0,
            totalLength
        )
        this.curveProgress = currentDistance / totalLength

        if (this.curveProgress >= 1) {
            if (!this.reached) {
                this.reached = true
                // const finalPos = this.curve.getPointAt(0.99)
                // const finalPos = this.curve.getPointAt(1)
                // this.model.position.copy(finalPos)
                this.playSequentialIdle()
            }
            return
        }

        const position = this.curve.getPointAt(this.curveProgress)
        this.model.position.lerp(position, 0.15)

        const tangent = this.curve.getTangentAt(this.curveProgress).normalize()
        const targetQuat = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 0, 1),
            tangent
        )
        this.model.quaternion.slerp(targetQuat, 0.1)
    }
}
