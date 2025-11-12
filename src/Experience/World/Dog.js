import * as THREE from 'three'
import Experience from '../Experience.js'
import { ANIMATION_NAMES, ANIMATIONS_BY_TYPE } from '../../../static/Configs/AnimationData.js'

const ROOM_DIMENSIONS = { width: 4.8, height: 4.8 }

export default class Dog {
    constructor() {
        this.experience = new Experience()
        this.scene = this.experience.scene
        this.resources = this.experience.resources
        this.time = this.experience.time
        this.debug = this.experience.debug

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
            const duration = idleAction._clip.duration * 1000
            setTimeout(() => {
                this.startNewPath()
            }, duration)
        } else {
            this.startNewPath()
        }
    }


    setModel() {
        this.model = this.resource.scene
        this.model.scale.set(1.6, 1.6, 1.6)
        this.model.traverse((child) => {
            if (child instanceof THREE.Mesh) {
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

        for (const name of ANIMATION_NAMES) {
            const clip = this.resource.animations[ANIMATION_NAMES.indexOf(name)]
            const action = this.animation.mixer.clipAction(clip)
            action.setLoop(THREE.LoopRepeat)
            action.clampWhenFinished = true
            this.animation.actions[name] = action
        }

        this.animation.play = (name) => {
            const newAction = this.animation.actions[name]
            const oldAction = this.animation.actions.current
            if (!newAction || newAction === oldAction) return
            if (oldAction) {
                newAction.reset()
                newAction.crossFadeFrom(oldAction, 0.3, true)
            }
            newAction.play()
            if (name != 'Walk_F_IP') {
                console.log(name);
            }

            this.animation.actions.current = newAction
        }

        const idle = this.idleAnimations[0]
        this.animation.actions.current = this.animation.actions[idle]
        this.animation.actions.current.play()
    }

    generateRandomCurve() {
        const halfW = ROOM_DIMENSIONS.width / 2
        const halfH = ROOM_DIMENSIONS.height / 2
        const start = this.model.position.clone()

        let end
        let attempts = 0
        const minDistance = 1.5
        do {
            end = new THREE.Vector3(
                THREE.MathUtils.randFloat(-halfW, halfW),
                0,
                THREE.MathUtils.randFloat(-halfH, halfH)
            )
            attempts++
        } while (start.distanceTo(end) < minDistance && attempts < 10)

        if (start.distanceTo(end) < minDistance) {
            const dir = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize()
            end = start.clone().addScaledVector(dir, minDistance)
        }

        const direction = new THREE.Vector3().subVectors(end, start).normalize()
        const distance = start.distanceTo(end)
        const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x).normalize()

        // ↓ Lowered curvature intensity for near-linear paths
        const offsetScale = Math.min(distance * 0.05, 0.1) // smaller max deviation
        const offset1 = (Math.random() - 0.5) * offsetScale
        const offset2 = (Math.random() - 0.5) * offsetScale

        const mid1 = new THREE.Vector3().lerpVectors(start, end, 0.33).addScaledVector(perpendicular, offset1)
        const mid2 = new THREE.Vector3().lerpVectors(start, end, 0.66).addScaledVector(perpendicular, offset2)

        // ↓ Increased tension toward 1.0 makes curve closer to straight lines
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


    /**
     * Calculates turn based on the dog's current facing direction
     */
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

        let side = 'Straight'
        if (signedDeg > 0.001) side = 'Left'
        else if (signedDeg < -0.001) side = 'Right'

        console.log(
            `%c[Dog Direction] %cTurn ${side} (${angleDeg.toFixed(1)}°) [Model-Oriented]`,
            'color:#ffaa00;font-weight:bold;',
            'color:#fff;'
        )

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
        if (this.turnDirection === 'Left') {
            if (this.turnAngle >= 150) visualTurnOffsetDeg = 80
            else if (this.turnAngle >= 40) visualTurnOffsetDeg = 40
        } else if (this.turnDirection === 'Right') {
            if (this.turnAngle >= 150) visualTurnOffsetDeg = -80
            else if (this.turnAngle >= 40) visualTurnOffsetDeg = -40
        }

        const correctedDir = actualDir.clone()
        const correctionMatrix = new THREE.Matrix4().makeRotationY(
            THREE.MathUtils.degToRad(-visualTurnOffsetDeg)
        )
        correctedDir.applyMatrix4(correctionMatrix).normalize()

        this.startQuaternion = this.model.quaternion.clone()
        this.endQuaternion = new THREE.Quaternion().setFromUnitVectors(forward, correctedDir)
        this.turnProgress = 0
        this.isTurning = true

        let turnAnim = 'Walk_F_IP'
        if (this.turnDirection === 'Left') {
            if (this.turnAngle < 10) turnAnim = 'Walk_F_IP'
            else if (this.turnAngle < 50) turnAnim = 'Turn_L_IP'
            else if (this.turnAngle < 135) turnAnim = 'Turn_L_IP'
            else turnAnim = 'Turn_L180_IP'
        } else if (this.turnDirection === 'Right') {
            if (this.turnAngle < 10) turnAnim = 'Walk_F_IP'
            else if (this.turnAngle < 50) turnAnim = 'Turn_R_IP'
            else if (this.turnAngle < 135) turnAnim = 'Turn_R_IP'
            else turnAnim = 'Turn_R180_IP'
        }

        this.animation.play(turnAnim)
        if (this.turnAngle < 10) this.turnDuration = 1
        else if (this.turnAngle < 45) this.turnDuration = 1
        else if (this.turnAngle < 90) this.turnDuration = 1
        else if (this.turnAngle < 135) this.turnDuration = 1
        else this.turnDuration = 1
    }

    /**
     * Play next idle animation in sequence after each walk.
     */
    playSequentialIdle() {
        if (!this.idleAnimations.length) return

        const idleName = this.idleAnimations[this.currentIdleIndex]
        const idleAction = this.animation.actions[idleName]
        if (!idleAction) return

        this.animation.play(idleName)

        const duration = idleAction._clip.duration * 1000
        this.currentIdleIndex = (this.currentIdleIndex + 1) % this.idleAnimations.length
        setTimeout(() => this.startNewPath(), duration)
    }

    update() {
        this.animation.mixer.update(this.time.delta * 0.001)

        if (this.isTurning) {
            this.turnProgress += (this.time.delta / 1000) / this.turnDuration
            if (this.turnProgress >= 1) {
                this.turnProgress = 1
                this.isTurning = false
                this.animation.play('Walk_F_IP')
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
