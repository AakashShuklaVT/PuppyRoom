import * as THREE from 'three'


export default class CurveGenerator {
    constructor(roomDimensions = { width: 4.8, height: 4.8 }) {
        this.room = roomDimensions
    }

    generate(startPosition, currentQuaternion, constraints) {
        const { minDistance, minTurnAngle, maxTurnAngle } = constraints

        const halfWidth = this.room.width / 2
        const halfHeight = this.room.height / 2
        const start = startPosition.clone()

        const currentForward = new THREE.Vector3(0, 0, 1)
            .applyQuaternion(currentQuaternion)
            .normalize()

        let end
        let attempts = 0
        const maxAttempts = 60

        do {
            end = new THREE.Vector3(
                THREE.MathUtils.randFloat(-halfWidth, halfWidth),
                0,
                THREE.MathUtils.randFloat(-halfHeight, halfHeight)
            )

            const dir = new THREE.Vector3().subVectors(end, start).normalize()
            const dot = THREE.MathUtils.clamp(currentForward.dot(dir), -1, 1)
            const angleDeg = THREE.MathUtils.radToDeg(Math.acos(dot))

            if (
                start.distanceTo(end) >= minDistance &&
                angleDeg >= minTurnAngle &&
                angleDeg <= maxTurnAngle
            ) break

            attempts++
        } while (attempts < maxAttempts)

        if (start.distanceTo(end) < minDistance) {
            const dir = currentForward.clone().applyAxisAngle(
                new THREE.Vector3(0, 1, 0),
                THREE.MathUtils.degToRad(
                    THREE.MathUtils.randFloat(minTurnAngle, maxTurnAngle) *
                    (Math.random() < 0.5 ? -1 : 1)
                )
            )
            end = start.clone().addScaledVector(dir, minDistance * 2)
        }

        const direction = new THREE.Vector3().subVectors(end, start).normalize()
        const distance = start.distanceTo(end)
        const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x).normalize()

        const offsetScale = Math.min(distance * 0.05, 0.2)
        const offset1 = (Math.random() - 0.5) * offsetScale
        const offset2 = (Math.random() - 0.5) * offsetScale

        const mid1 = new THREE.Vector3().lerpVectors(start, end, 0.33).addScaledVector(perpendicular, offset1)
        const mid2 = new THREE.Vector3().lerpVectors(start, end, 0.66).addScaledVector(perpendicular, offset2)

        const curve = new THREE.CatmullRomCurve3(
            [start, mid1, mid2, end],
            false,
            'catmullrom',
            0.99
        )

        const newDirection = direction.clone()
        return { curve, newDirection }
    }
}