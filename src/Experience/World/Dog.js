import * as THREE from 'three'
import Experience from '../Experience.js'
import {
    ANIMATION_NAMES as RAW_NAMES,
    ANIMATIONS_BY_TYPE,
    TURN_SIDES,
    FADE_RULES,
    ANIMATION_SEQUENCES,
    ANIMATION_LOOP_FLAGS
} from '../../../static/Configs/AnimationData.js'

import PointIndicator from '../Utils/PointIndicator.js'
import CurveGenerator from './CurveGenerator.js'
import BodyPartDetector from '../Utils/BodyPartDetector.js'

const ROOM_DIMENSIONS = { width: 4.8, height: 4.8 }

const ANIMATIONNAMES = {
    WALK_FORWARD: 'Walk_F_IP',
    TURN_LEFT: 'Turn_L_IP',
    TURN_RIGHT: 'Turn_R_IP',
    TURN_LEFT_180: 'Turn_L180_IP',
    TURN_RIGHT_180: 'Turn_R180_IP',
    RUN_FORWARD: 'Run_F_IP',
    RUN_LEFT: 'Run_L_IP',
    RUN_RIGHT: 'Run_R_IP',
    ATTACK: 'Attack_F',
    STOPPING_IDLE: 'Idle_7'
}

export default class Dog {
    constructor() {
        this.experience = new Experience()
        this.scene = this.experience.scene
        this.resources = this.experience.resources
        this.eventEmitter = this.experience.eventEmitter

        this.time = this.experience.time
        this.debug = this.experience.debug
        this.camera = this.experience.camera.instance

        // curve + movement state
        this.curve = null
        this.curveProgress = 0

        this.speed = 0.0006
        this.walkSpeed = 0.0006
        this.runSpeed = 0.002

        this.reached = false

        // turning state
        this.isTurning = false
        this.turnProgress = 0
        this.turnDuration = 2.0
        this.turnAngle = 0
        this.turnDirection = 'Straight'

        this.minDistance = 1.5
        this.minTurnAngle = 70
        this.maxTurnAngle = 135
        this.minAngle = 10

        this.idleAnimations = ANIMATIONS_BY_TYPE.idle
        this.stoppingAnimation = ANIMATIONNAMES.ATTACK
        this.currentIdleIndex = 0

        if (this.debug.active) this.debugFolder = this.debug.ui.addFolder('dog')

        this.resource = this.resources.items.dogModel

        this.setModel()

        this.curveGenerator = new CurveGenerator(ROOM_DIMENSIONS)

        this.bodyPartDetector = new BodyPartDetector({
            model: this.model,
            camera: this.camera,
            scene: this.scene,
            eventEmitter: this.eventEmitter,
            pointIndicatorFactory: () => new PointIndicator(128)
        })
        this.bodyPartDetector.startListening()

        this.uiElements()
        this.setAnimation()
        this.addEventListeners()

        const firstIdle = this.idleAnimations[0]
        const idleAction = this.animation.actions[firstIdle]

        this.elapsedIdleTime = 0
        this.idleActionDuration = idleAction._clip.duration * 1000

        if (idleAction) {
            this.animation.play(firstIdle)
            setTimeout(() => this.startNewPath(), idleAction._clip.duration * 1000)
        }
    }

    uiElements() {
        this.stoppingAnimationButton = document.getElementById('animation')
    }

    setModel() {
        this.model = this.resource.scene
        this.modelScaling = 1.6
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

        for (const name of RAW_NAMES) {
            const clip = this.resource.animations[RAW_NAMES.indexOf(name)]
            const action = this.animation.mixer.clipAction(clip)

            const shouldLoop = ANIMATION_LOOP_FLAGS[name] === true
            action.setLoop(shouldLoop ? THREE.LoopRepeat : THREE.LoopOnce)
            action.clampWhenFinished = true

            this.animation.actions[name] = action
        }

        this.animation.play = name => {
            const next = this.animation.actions[name]
            const prev = this.animation.actions.current
            if (!next || next === prev) return

            const fade = this.getFadeDuration(prev, next)

            next.reset()
            if (prev) next.crossFadeFrom(prev, fade, true)

            next.play()
            this.animation.actions.current = next
        }
    }

    getFadeDuration(prevAction, nextAction) {
        if (!prevAction) return 0.3
        if (prevAction === nextAction) return 0
        const a = prevAction._clip.name
        const b = nextAction._clip.name

        const rules = FADE_RULES
        for (const r of rules) {
            if (a.includes(r.from) && b.includes(r.to)) return r.fade
        }
        return 0.3
    }

    addEventListeners() {
        this.stoppingAnimationButton.addEventListener("change", (e) => {
            this.isOpen = e.target.checked
            this.stoppingAnimation = this.isOpen
                ? ANIMATIONNAMES.ATTACK
                : ANIMATIONNAMES.STOPPING_IDLE
        })
    }

    getDirectionChange(model, newTargetDirection) {
        const currentForward = new THREE.Vector3(0, 0, 1)
            .applyQuaternion(model.quaternion)
            .normalize()

        currentForward.y = 0
        newTargetDirection.y = 0

        const cross = new THREE.Vector3().crossVectors(currentForward, newTargetDirection)
        const dot = THREE.MathUtils.clamp(currentForward.dot(newTargetDirection), -1, 1)

        const signedAngle = Math.atan2(cross.y, dot)
        const signedDeg = THREE.MathUtils.radToDeg(signedAngle)
        const angleDeg = Math.abs(signedDeg)

        let side = TURN_SIDES.STRAIGHT
        if (signedDeg > 0.001) side = TURN_SIDES.LEFT
        else if (signedDeg < -0.001) side = TURN_SIDES.RIGHT

        this.turnAngle = angleDeg
        this.turnDirection = side
    }

    startNewPath() {
        const { curve, newDirection } = this.curveGenerator.generate(
            this.model.position,
            this.model.quaternion,
            {
                minDistance: this.minDistance,
                minTurnAngle: this.minTurnAngle,
                maxTurnAngle: this.maxTurnAngle
            }
        )

        this.curve = curve
        this.curveProgress = 0
        this.reached = false

        this.getDirectionChange(this.model, newDirection)

        const start = this.model.position.clone()
        const end = this.curve.points[this.curve.points.length - 1].clone()
        const dist = start.distanceTo(end)

        this.shouldRun = dist >= 2.5
        this.speed = this.shouldRun ? this.runSpeed : this.walkSpeed

        const forward = new THREE.Vector3(0, 0, 1)
        const actualDir = newDirection.clone().normalize()

        let visualTurnOffsetDeg = 0
        if (this.turnDirection === TURN_SIDES.LEFT && this.turnAngle >= 40) visualTurnOffsetDeg = 60
        else if (this.turnDirection === TURN_SIDES.RIGHT && this.turnAngle >= 40) visualTurnOffsetDeg = -60

        const correctedDir = actualDir.clone()
        correctedDir.applyMatrix4(
            new THREE.Matrix4().makeRotationY(
                THREE.MathUtils.degToRad(-visualTurnOffsetDeg)
            )
        ).normalize()

        this.startQuaternion = this.model.quaternion.clone()
        this.endQuaternion = new THREE.Quaternion().setFromUnitVectors(forward, correctedDir)

        this.turnProgress = 0
        this.isTurning = true

        let turnAnim
        if (this.turnDirection === TURN_SIDES.LEFT) {
            turnAnim = this.turnAngle < this.minAngle
                ? ANIMATIONNAMES.WALK_FORWARD
                : ANIMATIONNAMES.TURN_LEFT
        } else if (this.turnDirection === TURN_SIDES.RIGHT) {
            turnAnim = this.turnAngle < this.minAngle
                ? ANIMATIONNAMES.WALK_FORWARD
                : ANIMATIONNAMES.TURN_RIGHT
        }

        this.animation.play(turnAnim)

        const clip = this.animation.actions[turnAnim]?._clip
        const clipDuration = clip ? clip.duration : 1.0
        const normalized = THREE.MathUtils.clamp(
            (this.turnAngle - this.minAngle) / (this.maxTurnAngle - this.minAngle),
            0,
            1
        )
        this.turnDuration = THREE.MathUtils.lerp(clipDuration * 0.8, clipDuration * 1.2, normalized)
    }

    playSequentialIdle(first = false) {
        if (!this.idleAnimations.length) return

        if (first) {
            const idleName = this.stoppingAnimation
            const idleAction = this.animation.actions[idleName]
            if (!idleAction) return

            this.animation.play(idleName)

            const duration = idleAction._clip.duration * 1000
            setTimeout(() => this.playSequentialIdle(), duration)
        }
        else {
            const roll = Math.random()
            const chance = 0.3

            if (roll < chance) {
                const idleName = this.idleAnimations[Math.floor(Math.random() * this.idleAnimations.length)]
                const idleAction = this.animation.actions[idleName]
                if (!idleAction) return

                this.animation.play(idleName)

                const duration = idleAction._clip.duration * 1000
                setTimeout(() => this.startNewPath(), duration)
                return
            }

            this.playSequentialAnimation(false)
        }
    }

    playSequentialAnimation(playNext = true) {
        if (!playNext) {
            const sequenceKeys = Object.keys(ANIMATION_SEQUENCES)
            const chosenKey = sequenceKeys[Math.floor(Math.random() * sequenceKeys.length)]
            this.currentSequence = ANIMATION_SEQUENCES[chosenKey]
            this.currentSeqIndex = 0
        }

        if (!this.currentSequence || this.currentSeqIndex >= this.currentSequence.length) {
            this.startNewPath()
            return
        }

        const animName = this.currentSequence[this.currentSeqIndex]
        const animAction = this.animation.actions[animName]

        if (!animAction) {
            this.currentSeqIndex++
            this.playSequentialAnimation(true)
            return
        }

        this.animation.play(animName)

        const duration = animAction._clip.duration * 1000
        this.currentSeqIndex++

        setTimeout(() => this.playSequentialAnimation(true), duration)
    }

    update() {
        this.animation.mixer.update(this.time.delta * 0.001)

        if (this.bodyPartDetector?.pointIndicator) {
            this.bodyPartDetector.pointIndicator.update(this.time.delta / 1000)
        }

        if (this.isTurning) {
            this.turnProgress += this.time.delta / 1000 / this.turnDuration
            if (this.turnProgress >= 1) {
                this.turnProgress = 1
                this.isTurning = false

                const next = this.shouldRun
                    ? ANIMATIONNAMES.RUN_FORWARD
                    : ANIMATIONNAMES.WALK_FORWARD

                this.animation.play(next)
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
            this.curveProgress * totalLength + distancePerFrame, 0, totalLength
        )

        this.curveProgress = currentDistance / totalLength

        if (this.curveProgress >= 1) {
            if (!this.reached) {
                this.reached = true
                this.playSequentialIdle(true)
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
