import * as THREE from 'three'
import Experience from './Experience.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export default class Camera {
    constructor() {
        this.experience = new Experience()
        this.sizes = this.experience.sizes
        this.scene = this.experience.scene
        this.canvas = this.experience.canvas

        this.setInstance()
        this.setControls()
        this.setupEventListeners()
        this.addResizeListeners()
    }

    getCameraConfig(width) {
        if (width <= 500) {
            return { fov: 55, position: new THREE.Vector3(3.5, 3, 3.5) }
        }
        else if (width <= 756) {
            return { fov: 50, position: new THREE.Vector3(3.2, 2.7, 3.2) }
        }
        else if (width <= 1024) {
            return { fov: 50, position: new THREE.Vector3(3.2, 2.7, 3.2) }
        }
        else {
            return { fov: 35, position: new THREE.Vector3(3, 2.5, 3) }
        }
    }

    setInstance() {
        const { width, height } = this.sizes
        const config = this.getCameraConfig(width)

        this.instance = new THREE.PerspectiveCamera(
            config.fov,
            width / height,
            0.03,
            100
        )

        this.instance.position.copy(config.position)
        this.scene.add(this.instance)
    }

    setControls() {
        this.controls = new OrbitControls(this.instance, this.canvas)
        this.controls.enableDamping = true
        this.controls.minDistance = 2
        this.controls.maxDistance = 8
        this.controls.maxPolarAngle = Math.PI * 0.45
        this.controls.target.set(0, 0.5, 0.5)
        this.controls.enablePan = false
        this.controls.autoRotate = false
        this.controls.update()
    }

    setupEventListeners() {
        this.panningButton = document.getElementById('panning')
        this.panningButton.addEventListener('change', (e) => {
            const enabled = e.target.checked
            this.controls.enablePan = enabled
        })
    }

    updateCameraConfig() {
        const width = window.innerWidth
        const height = window.innerHeight
        const config = this.getCameraConfig(width)

        this.instance.fov = config.fov
        this.instance.position.copy(config.position)
        this.instance.aspect = width / height
        this.instance.updateProjectionMatrix()
    }

    addResizeListeners() {
        window.addEventListener('resize', () => {
            this.updateCameraConfig()
        })
    }

    resize() {
        this.updateCameraConfig()
    }

    update() {
        this.controls.update()
    }
}
