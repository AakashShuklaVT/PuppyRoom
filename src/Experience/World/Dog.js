import * as THREE from 'three'
import Experience from '../Experience.js'
import { ANIMATION_NAMES as RAW_NAMES, ANIMATIONS_BY_TYPE, TURN_SIDES, FADE_RULES, ANIMATION_SEQUENCES, ANIMATION_LOOP_FLAGS } from '../../../static/Configs/AnimationData.js'
import { BONES_LABEL } from '../../../static/Configs/BonesLabel.js'
import PointIndicator from '../Utils/PointIndicator.js'

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

        this.curve = null
        this.curveProgress = 0

        this.speed = 0.0006
        this.walkSpeed = 0.0006
        this.runSpeed = 0.002

        this.reached = false

        this.isTurning = false
        this.turnProgress = 0
        this.turnDuration = 2.0
        this.turnAngle = 0
        this.turnDirection = 'Straight'

        this.idleAnimations = ANIMATIONS_BY_TYPE.idle

        this.stoppingAnimation = 'Idle_7'
        this.currentIdleIndex = 0

        if (this.debug.active) this.debugFolder = this.debug.ui.addFolder('dog')

        this.resource = this.resources.items.dogModel

        this.setModel()
        this.setAnimation()
        this.setupRaycaster()
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

    setupRaycaster() {
        this.raycaster = new THREE.Raycaster();
        this.pointer = new THREE.Vector2();
        this.camera = this.experience.camera.instance;
    }

    addEventListeners() {
        this.dragging = false;

        window.addEventListener('pointerdown', e => {
            this.dragging = true;
            this.updatePointer(e);
            this.getClickedPartName();
        });

        window.addEventListener('pointermove', e => {
            if (!this.dragging) return;
            this.updatePointer(e);
            this.getClickedPartName();
        });

        window.addEventListener('pointerup', () => {
            this.dragging = false;
        });
    }

    updatePointer(e) {
        if (!this.dragging) return;
        this.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
        this.pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.pointer, this.camera);
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

        const start = this.model.position.clone()
        const end = this.curve.points[this.curve.points.length - 1].clone()
        const dist = start.distanceTo(end)
        const runThreshold = 2.5
        this.shouldRun = dist >= runThreshold
        this.speed = this.shouldRun ? this.runSpeed : this.walkSpeed

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
        this.endQuaternion = new THREE.Quaternion().setFromUnitVectors(forward, correctedDir)
        this.turnProgress = 0
        this.isTurning = true
        this.minAngle = 10

        let turnAnim

        if (this.turnDirection === TURN_SIDES.LEFT) {
            if (this.turnAngle < this.minAngle) turnAnim = ANIMATIONNAMES.WALK_FORWARD
            else if (this.turnAngle < this.maxTurnAngle) turnAnim = ANIMATIONNAMES.TURN_LEFT
        }
        else if (this.turnDirection === TURN_SIDES.RIGHT) {
            if (this.turnAngle < this.minAngle) turnAnim = ANIMATIONNAMES.WALK_FORWARD
            else if (this.turnAngle < this.maxTurnAngle) turnAnim = ANIMATIONNAMES.TURN_RIGHT
        }

        this.animation.play(turnAnim)

        const clip = this.animation.actions[turnAnim]?._clip
        const clipDuration = clip ? clip.duration : 1.0
        const normalized = THREE.MathUtils.clamp((this.turnAngle - this.minAngle) / (this.maxTurnAngle - this.minAngle), 0, 1)
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
                const idleName = this.idleAnimations[
                    Math.floor(Math.random() * this.idleAnimations.length)
                ]
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
            this.currentSeqIndex = this.currentSeqIndex + 1
            this.playSequentialAnimation(true)
            return
        }
        this.animation.play(animName)
        const duration = animAction._clip.duration * 1000

        this.currentSeqIndex = this.currentSeqIndex + 1
        setTimeout(() => {
            this.playSequentialAnimation(true)
        }, duration)
    }

    getClickedPartName() {
        const hit = this.getHit();
        if (!hit) return;

        const bone = this.getNearestBone(hit);
        if (!bone) return;

        const name = this.resolveBoneName(bone.name);

        this.eventEmitter.trigger('bodyPartClicked', [name])

        if (!this.pointIndicator) {
            this.pointIndicator = new PointIndicator(128);
        }

        const sprite = this.pointIndicator.sprite;
        this.pointIndicator.elapsedTime = 0
        if (sprite.parent) sprite.parent.remove(sprite);

        bone.add(sprite);

        const localPos = bone.worldToLocal(hit.point.clone());
        sprite.position.copy(localPos);
        sprite.visible = true;
    }

    getHit() {
        const hits = this.raycaster.intersectObject(this.model, true);
        if (!hits.length) return null;

        const h = hits[0];
        if (!h.object.isSkinnedMesh) return null;

        return h;
    }

    getNearestBone(hit) {
        const pos = hit.point.clone();
        let best = null;
        let bestDist = Infinity;

        for (const bone of hit.object.skeleton.bones) {
            const inv = new THREE.Matrix4().copy(bone.matrixWorld).invert();
            const local = pos.clone().applyMatrix4(inv);
            const d = local.length();

            if (d < bestDist) {
                bestDist = d;
                best = bone;
            }
        }
        return best;
    }

    resolveBoneName(rawName) {
        return BONES_LABEL[rawName] || rawName;
    }

    update() {
        this.animation.mixer.update(this.time.delta * 0.001)

        if (this.pointIndicator) {
            this.pointIndicator.update(this.time.delta / 1000)
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
        const currentDistance = THREE.MathUtils.clamp(this.curveProgress * totalLength + distancePerFrame, 0, totalLength)
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
        const targetQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent)
        this.model.quaternion.slerp(targetQuat, 0.1)
    }
}
