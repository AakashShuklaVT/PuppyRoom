// BodyPartDetector.js
import * as THREE from 'three'
import { BONES_LABEL } from '../../../static/Configs/BonesLabel.js'

export default class BodyPartDetector {
    constructor({ model, camera, scene, eventEmitter, pointIndicatorFactory = null }) {
        this.model = model
        this.camera = camera
        this.scene = scene
        this.eventEmitter = eventEmitter
        this.pointIndicatorFactory = pointIndicatorFactory

        this.raycaster = new THREE.Raycaster()
        this.pointer = new THREE.Vector2()
        this.dragging = false
        this.pointIndicator = null

        this._onPointerDown = this._onPointerDown.bind(this)
        this._onPointerMove = this._onPointerMove.bind(this)
        this._onPointerUp = this._onPointerUp.bind(this)
    }

    startListening() {
        window.addEventListener('pointerdown', this._onPointerDown)
        window.addEventListener('pointermove', this._onPointerMove)
        window.addEventListener('pointerup', this._onPointerUp)
    }

    stopListening() {
        window.removeEventListener('pointerdown', this._onPointerDown)
        window.removeEventListener('pointermove', this._onPointerMove)
        window.removeEventListener('pointerup', this._onPointerUp)
    }

    _onPointerDown(e) {
        if (e.button !== 0) return
        this.dragging = true
        this.updatePointerFromEvent(e)
        this._handleHit()
    }

    _onPointerMove(e) {
        if (!this.dragging) return
        this.updatePointerFromEvent(e)
        this._handleHit()
    }

    _onPointerUp() {
        this.dragging = false
    }

    updatePointerFromEvent(e) {
        this.pointer.x = (e.clientX / window.innerWidth) * 2 - 1
        this.pointer.y = -(e.clientY / window.innerHeight) * 2 + 1
        this.raycaster.setFromCamera(this.pointer, this.camera)
    }

    _handleHit() {
        const hit = this.getHit()
        if (!hit) return

        const bone = this.getNearestBone(hit)
        if (!bone) return

        const name = this.resolveBoneName(bone.name)
        this.eventEmitter.trigger('bodyPartClicked', [name])

        if (this.pointIndicatorFactory && !this.pointIndicator) {
            this.pointIndicator = this.pointIndicatorFactory()
        }

        if (this.pointIndicator) {
            const sprite = this.pointIndicator.sprite
            this.pointIndicator.elapsedTime = 0
            if (sprite.parent) sprite.parent.remove(sprite)

            bone.add(sprite)
            const localPos = bone.worldToLocal(hit.point.clone())
            sprite.position.copy(localPos)
            sprite.visible = true
        }
    }

    getHit() {
        if (!this.model) return null
        const hits = this.raycaster.intersectObject(this.model, true)
        if (!hits.length) return null
        const h = hits[0]
        if (!h.object.isSkinnedMesh) return null
        return h
    }

    getNearestBone(hit) {
        const pos = hit.point.clone()
        let best = null
        let bestDist = Infinity

        for (const bone of hit.object.skeleton.bones) {
            const inv = new THREE.Matrix4().copy(bone.matrixWorld).invert()
            const local = pos.clone().applyMatrix4(inv)
            const d = local.length()

            if (d < bestDist) {
                bestDist = d
                best = bone
            }
        }
        return best
    }

    resolveBoneName(rawName) {
        return BONES_LABEL[rawName] || rawName
    }

    dispose() {
        this.stopListening()
        this.pointIndicator = null
        this.model = null
        this.camera = null
        this.scene = null
        this.eventEmitter = null
    }
}
