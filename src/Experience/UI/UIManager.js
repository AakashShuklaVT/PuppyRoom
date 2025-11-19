import Experience from "../Experience"
import ConsoleUI from "./ConsoleUI.js"


export default class UIManager {
    static instance = null

    constructor() {
        if (UIManager.instance) 
            return UIManager.instance
        UIManager.instance = this

        this.experience = new Experience()
        this.scene = this.experience.scene
        this.eventEmitter = this.experience.eventEmitter
        this.initUI()
    }

    initUI() {
       this.consoleUI = new ConsoleUI()
    }

    update() {
        
    }
}
