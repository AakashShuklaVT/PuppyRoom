import * as THREE from 'three'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { SSRPass } from 'three/examples/jsm/postprocessing/SSRPass.js'
import { SAOPass } from 'three/examples/jsm/postprocessing/SAOPass.js'
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { ColorCorrectionShader } from 'three/examples/jsm/shaders/ColorCorrectionShader.js'
import { GammaCorrectionShader } from 'three/examples/jsm/shaders/GammaCorrectionShader.js'
import { VignetteShader } from 'three/examples/jsm/shaders/VignetteShader.js'
import { HueSaturationShader } from 'three/addons/shaders/HueSaturationShader.js'
import Experience from '../Experience';
import { EffectComposer } from 'three/examples/jsm/Addons.js';

export default class PostProcessing {
    constructor() {
        this.experience = new Experience()
        this.canvas = this.experience.canvas
        this.sizes = this.experience.sizes
        this.scene = this.experience.scene
        this.camera = this.experience.camera
        this.renderer = this.experience.renderer

        this.ssrobjects = this.experience.ssrObjects
        this.debug = this.experience.debug

        this.setupEffectComposer()
        this.addSSRPass()
        this.addSAOPass()
        this.addVignettePass()
        this.addHueSaturationPass()
        this.addSMAAAntiAliasPass()
        this.addGammaCorrectionPass()
        this.setupEventListeners()
    }

    addHueSaturationPass() {
        const hueSaturationPass = new ShaderPass(HueSaturationShader)
        hueSaturationPass.uniforms["hue"].value = 0
        hueSaturationPass.uniforms["saturation"].value = 0.2
        this.effectComposer.addPass(hueSaturationPass)
    }

    setupEventListeners() {
        this.ssrButton = document.getElementById('ssr')
        this.ssrButton.addEventListener('change', (e) => {
            const enabled = e.target.checked
            this.setSSREnabled(enabled)
        })
    }

    setSSREnabled(enabled) {
        this.ssrPass.enabled = enabled
    }

    setupEffectComposer() {
        this.effectComposer = new EffectComposer(this.renderer.instance)
        this.effectComposer.setSize(this.sizes.width, this.sizes.height)
        this.effectComposer.setPixelRatio(this.sizes.pixelRatio)
        this.renderPass = new RenderPass(this.scene, this.camera.instance)
        this.effectComposer.addPass(this.renderPass)
    }

    addSSRPass() {
        this.ssrPass = new SSRPass({
            renderer: this.experience.renderer.instance,
            scene: this.experience.scene,
            camera: this.experience.camera.instance,
            width: this.experience.sizes.width,
            height: this.experience.sizes.height,
            selects: this.experience.ssrObjects
        })

        this.ssrPass.renderToScreen = true;
        this.ssrPass.infiniteThick = false;
        this.ssrPass.thickness = 0;
        this.ssrPass.maxDistance = 10;
        this.ssrPass.distanceAttenuation = true;
        this.ssrPass.fresnel = true;
        this.ssrPass.blur = true;
        this.ssrPass.opacity = 0.15
        this.ssrPass.bouncing = false
        this.ssrPass.tempColor = new THREE.Color(0xff0000)
        this.ssrPass.enabled = false
        if (this.debug.active) {
            const SSREffectFolder = this.debug.ui.addFolder("SSR Properties");
            SSREffectFolder.add(this.ssrPass, "infiniteThick");
            SSREffectFolder.add(this.ssrPass, "renderToScreen");
            SSREffectFolder.add(this.ssrPass, "opacity").min(0).max(1).step(0.01);
            SSREffectFolder.add(this.ssrPass, "height").min(0).max(100).step(0.1);
            SSREffectFolder.add(this.ssrPass, "width").min(0).max(100).step(0.1);
            SSREffectFolder.add(this.ssrPass, "maxDistance").min(0).max(100).step(0.1);
            SSREffectFolder.add(this.ssrPass, "thickness").min(0).max(10).step(0.0001);
            SSREffectFolder.add(this.ssrPass, "distanceAttenuation").onChange((value) => {
                this.ssrPass.distanceAttenuation = value;
            });
            SSREffectFolder.add(this.ssrPass, "blur");
            SSREffectFolder.add(this.ssrPass, "fresnel");
            SSREffectFolder.add(this.ssrPass, "output", {
                Default: SSRPass.OUTPUT.Default,
                "SSR Only": SSRPass.OUTPUT.SSR,
                Beauty: SSRPass.OUTPUT.Beauty,
                Depth: SSRPass.OUTPUT.Depth,
                Normal: SSRPass.OUTPUT.Normal,
                Metalness: SSRPass.OUTPUT.Metalness,
            }).onChange(function (value) {
                this.ssrPass.output = value;
            });
            SSREffectFolder.close();
        }
        this.effectComposer.addPass(this.ssrPass)
    }

    addSAOPass() {
        const saoPass = new SAOPass(this.scene, this.camera.instance, false, true)
        saoPass.clear = true;
        saoPass.renderToScreen = true;

        saoPass.params.saoBias = 0.5
        saoPass.params.saoIntensity = 0.4
        saoPass.params.saoScale = 52
        saoPass.params.saoKernelRadius = 100
        saoPass.params.saoMinResolution = 0
        saoPass.blur = true;

        this.effectComposer.addPass(saoPass)

        if (this.debug.active) {
            const SAOEffectFolder = this.debug.ui.addFolder("SAO Properties");
            SAOEffectFolder.add(saoPass.params, "saoBias").min(0).max(1).step(0.0001)
            SAOEffectFolder.add(saoPass.params, "saoIntensity").min(0).max(1).step(0.0001)
            SAOEffectFolder.add(saoPass.params, "saoScale").min(0).max(100).step(0.1)
            SAOEffectFolder.add(saoPass.params, "saoKernelRadius").min(0).max(100).step(0.1)
            SAOEffectFolder.add(saoPass.params, "saoMinResolution").min(0).max(100).step(0.1)
            SAOEffectFolder.close();
        }
    }

    addVignettePass() {
        const vignettePass = new ShaderPass(VignetteShader)
        vignettePass.uniforms["offset"].value = 0.25  
        vignettePass.uniforms["darkness"].value = 3  
        this.effectComposer.addPass(vignettePass)

        // Optional Debug controls
        if (this.debug.active) {
            const vignetteFolder = this.debug.ui.addFolder("Vignette Properties")
            vignetteFolder.add(vignettePass.uniforms["offset"], "value")
                .min(0.0).max(2.0).step(0.01).name("Offset")
            vignetteFolder.add(vignettePass.uniforms["darkness"], "value")
                .min(0.0).max(3.0).step(0.01).name("Darkness")
            vignetteFolder.close()
        }
    }

    addSMAAAntiAliasPass() {
        const smaaPass = new SMAAPass()
        this.effectComposer.addPass(smaaPass)
    }

    addGammaCorrectionPass() {
        const gammaCorrectionPass = new ShaderPass(GammaCorrectionShader)
        this.effectComposer.addPass(gammaCorrectionPass)
    }

    resize() {
        this.effectComposer.setSize(this.sizes.width, this.sizes.height)
        this.effectComposer.setPixelRatio(this.sizes.pixelRatio)
    }

    update() {
        this.effectComposer.render()
    }
}