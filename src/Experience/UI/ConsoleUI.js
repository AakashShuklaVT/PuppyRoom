import Experience from "../Experience"
import gsap from "gsap"

export default class ConsoleUI {

    constructor() {
        this.experience = new Experience()
        this.eventEmitter = this.experience.eventEmitter
        this.threshold = 768
        this.isMobile = window.innerWidth < this.threshold
        this.getUIElements()
        this.registerEventListeners()

        this.isOpen = false
    }

    getUIElements() {
        const root = document.querySelector(".console-ui")

        this.root = root
        this.content = root.querySelector(".console-content")
        this.topPanel = root.querySelector(".top-panel-console")
        this.heading = root.querySelector(".console-heading")

        this.middlePanel = root.querySelector(".middle-panel-console")
        this.consoleHead = root.querySelector(".console-head")
        this.console = root.querySelector(".console")

        this.logLines = root.querySelectorAll(".log-line")
        this.lastLog = root.querySelector(".log-line:last-child")
        this.consoleButton = document.getElementById("console")
    }

    registerEventListeners() {
        this.eventEmitter.on("bodyPartClicked", (name) => {
            this.addLog(name)
        })

        this.consoleButton.addEventListener("change", (e) => {
            this.isOpen = e.target.checked
            if (this.isOpen) {
                this.showAnimation()
            } else {
                this.hideAnimation()
            }
        })
    }

    addLog(name) {
        const time = new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
        })

        const row = document.createElement("div")
        row.className = "log-line"

        row.innerHTML = `
            <span class="log-time">${time}</span>
            <span class="log-text">${name}</span>
        `

        this.console.appendChild(row)
        this.console.scrollTop = this.console.scrollHeight
    }

    showAnimation() {
        this.isMobile = window.innerWidth < this.threshold
        this.root.style.display = "flex"

        this.consoleButton.disabled = true

        if (this.isMobile) {
            gsap.set(this.root, { y: "-100%", x: 0 })

            gsap.to(this.root, {
                y: "0%",
                duration: 0.35,
                ease: "power2.out",
                onComplete: () => {
                    this.consoleButton.disabled = false
                }
            })
        } else {
            gsap.set(this.root, { x: "-100%", y: 0 })

            gsap.to(this.root, {
                x: "0%",
                duration: 0.35,
                ease: "power2.out",
                onComplete: () => {
                    this.consoleButton.disabled = false
                }
            })
        }
    }

    hideAnimation() {
        this.isMobile = window.innerWidth < this.threshold

        this.consoleButton.disabled = true

        if (this.isMobile) {
            gsap.to(this.root, {
                y: "-100%",
                duration: 0.35,
                ease: "power2.in",
                onComplete: () => {
                    this.root.style.display = "none"
                    this.consoleButton.disabled = false
                }
            })
        } else {
            gsap.to(this.root, {
                x: "-100%",
                duration: 0.35,
                ease: "power2.in",
                onComplete: () => {
                    this.root.style.display = "none"
                    this.consoleButton.disabled = false
                }
            })
        }
    }

}
