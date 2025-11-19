import * as THREE from 'three'
import Experience from '../Experience.js'

const ROOM_CHILDREN = {
    Wall : 'Wall',
    Floor : 'Floor',
}

export default class Room {
    constructor() {
        this.experience = new Experience()
        this.scene = this.experience.scene
        this.resources = this.experience.resources
        this.time = this.experience.time
        this.camera = this.experience.camera.instance
        this.debug = this.experience.debug
        this.eventEmitter = this.experience.eventEmitter
        this.resource = this.resources.items.roomModel
        this.setModel()
    }

    setModel() {
        this.model = this.resource.scene
        this.model.scale.set(1, 1, 1)

        this.model.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.receiveShadow = true
            }
            if (child.name.includes(ROOM_CHILDREN.Wall)) {
                child.material.side = THREE.FrontSide
                child.material.color = new THREE.Color('#b9b8b8')
            }
            if (child.name.includes(ROOM_CHILDREN.Floor)) {
                this.experience.ssrObjects.push(child)
            }
        })
        this.scene.add(this.model)
    }
}
