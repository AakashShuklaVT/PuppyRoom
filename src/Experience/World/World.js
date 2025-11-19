import Experience from '../Experience.js'
import Environment from './Environment.js'
import Dog from './Dog.js'
import Room from './Room.js'

export default class World {
    constructor() {
        this.experience = new Experience()
        this.scene = this.experience.scene
        this.resources = this.experience.resources
        
        // Wait for resources
        this.resources.on('ready', () => {
            this.dog = new Dog()
            this.room = new Room()
            this.environment = new Environment()
        })
    }

    update() {
        if (this.dog) {
            this.dog.update()
        }
    }
}