import * as THREE from 'three';

export default class PointIndicator {
    constructor(size = 64, color = 'red') {
        this.size = size;
        this.color = color;

        this.canvas = document.createElement('canvas');
        this.canvas.width = size;
        this.canvas.height = size;

        this.ctx = this.canvas.getContext('2d');
        this.drawDot();

        this.texture = new THREE.CanvasTexture(this.canvas);
        this.material = new THREE.SpriteMaterial({ map: this.texture, transparent: true, depthTest: false });

        this.sprite = new THREE.Sprite(this.material);
        this.sprite.scale.set(0.1, 0.1, 0.1); 
        this.sprite.visible = false;
    }

    drawDot() {
        const c = this.ctx;
        const s = this.size;
        const h = s / 2;

        c.clearRect(0, 0, s, s);
        c.save();
        c.translate(h, h);

        const edge = "#000000";
        const fill = "#ffffff";

        const r = s * 0.32;

        c.beginPath();
        c.moveTo(0, -r);
        c.lineTo(r, 0);
        c.lineTo(0, r);
        c.lineTo(-r, 0);
        c.closePath();
        c.lineWidth = s * 0.10;
        c.strokeStyle = edge;
        c.stroke();

        const r2 = s * 0.18;
        c.beginPath();
        c.moveTo(0, -r2);
        c.lineTo(r2, 0);
        c.lineTo(0, r2);
        c.lineTo(-r2, 0);
        c.closePath();
        c.fillStyle = fill;
        c.fill();

        c.beginPath();
        c.arc(0, 0, s * 0.06, 0, Math.PI * 2);
        c.fillStyle = edge;
        c.fill();

        c.restore();
    }


    // drawDot() {
    //     const c = this.ctx;
    //     const s = this.size;
    //     const h = s / 2;

    //     c.clearRect(0, 0, s, s);
    //     c.save();
    //     c.translate(h, h);

    //     const col = "#ffffff";   
    //     const edge = "#000000";

    //     c.beginPath();
    //     c.arc(0, 0, s * 0.35, 0, Math.PI * 2);
    //     c.lineWidth = s * 0.12;
    //     c.strokeStyle = edge;
    //     c.stroke();

    //     c.beginPath();
    //     c.arc(0, 0, s * 0.2, 0, Math.PI * 2);
    //     c.fillStyle = col;
    //     c.fill();

    //     c.beginPath();
    //     c.arc(0, 0, s * 0.07, 0, Math.PI * 2);
    //     c.fillStyle = edge;
    //     c.fill();

    //     c.restore();
    // }

    attachToScene(scene) {
        scene.add(this.sprite);
    }

    showAt(position) {
        this.sprite.position.copy(position);
        this.sprite.visible = true;
    }

    hide() {
        this.sprite.visible = false;
    }
}
