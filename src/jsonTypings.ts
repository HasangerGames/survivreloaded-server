import { type LooseLoot } from "./game/objects/loot";
import { type MinMax } from "./utils/math";
import { type Orientation } from "./utils/constants";

export interface Point2D {
    x: number
    y: number
}

export type Collider = ({
    type: 0
    pos: Point2D
    min?: Point2D
    max?: Point2D
} | {
    type: 1
    min: Point2D
    max: Point2D
}) & {
    rad?: number
    height: number
};

export namespace JSONObjects {
    export interface Random {
        type: "random"
        weights: Record<string, number>
    }

    export interface Obstacle {
        type: "obstacle"
        obstacleType?: string
        weights: Record<string, number>
        scale: {
            createMin: number
            createMax: number
            destroy: number
        }
        armorPlated?: boolean
        stonePlated?: boolean
        collision: Collider
        height: number
        collidable: boolean
        destructible: boolean
        explosion: string
        health: number
        reflectBullets: boolean
        loot: Array<{
            tier: string
            min: number
            max: number
            props: Record<string, unknown>
        }>
        map: {
            display: true
            color: number
            scale: 1
        } | {
            display: false
        }
        terrain: {
            grass: boolean
            beach: boolean
        }
        teamId?: number
        lifeTime?: number
    }

    export interface Wall extends Obstacle {
        isWall: true
        material: string
        extents: Point2D
    }

    export interface ObstacleReference {
        type: string
        pos: Point2D
        scale: number
        ori: Orientation
        inheritOri?: boolean
        ignoreMapSpawnReplacement?: boolean
        bunkerWall?: boolean
        puzzlePiece?: string
    }

    interface ObstacleGroup {
        ori?: number
        mapObstacleBounds: Array<MinMax<Point2D>>
        terrain: {
            grass: boolean
            beach: boolean
            bridge?: {
                nearbyWidthMult: number
            }
            spawnPriority?: number
        } | {
            waterEdge: {
                dir: Point2D
                distMin: number
                distMax: number
            }
        }
    }

    export type Building = ObstacleGroup & {
        type: "building"
        map: {
            displayType: string
        } | {
            display: false
        } | ({
            display: boolean
        } & ({
            color: number
            scale: number
        } | {
            shapes: Array<{
                collider: Collider
                color: number
            }>
        }))
        terrain: {
            grass: boolean
            beach: boolean
            river?: {
                centerWeight: number
            }
            riverShore?: boolean
            lakeCenter?: boolean
            bridge?: {
                nearbyWidthMult: number
            }
            spawnPriority?: number
            nearbyRiver?: {
                radMin: number
                radMax: number
                facingOri: Orientation
            }
        } | {
            waterEdge: {
                dir: Point2D
                distMin: number
                distMax: number
            }
        } | Record<string, unknown>
        oris?: number[]
        zIdx?: number
        mapGroundPatches?: Array<{
            bound: Collider
            color?: number
            roughness?: number
            offsetDist?: number
            order?: number
            useAsMapShape?: boolean
        }>
        floor: {
            surfaces: Array<{
                type: string
                collision: Collider[]
            }>
        }
        ceiling: {
            zoomRegions: Array<{
                zoomIn: Collider
                zoomOut?: Collider
                zoom?: number
            }>
            vision?: {
                dist?: number
                width?: number
                linger?: number
                fadeRate?: number
            }
            destroy?: {
                wallCount?: number
                particle?: string
                particleCount?: number
                residue?: string
            }
            damage?: {
                obstacleCount: number
            }
        }
        mapObjects: ObstacleReference[]
        puzzle: {
            name: string
            completeUseType: string
            completeOffDelay: number
            completeUseDelay: number
            errorResetDelay: number
            pieceResetDelay: number
            order: string[]
        }

        groundTintLt?: number
        groundTintDk?: number
        statue?: string
        crate?: string
        bonus_room?: string
        bonus_door?: string
        porch_01?: string
        stand?: string
        cabin_mount?: string
        tree?: string
        grass_color?: string
        tree_large?: string
        tree_small?: string
        tree_scale?: number
        tree_loot?: string
        bush_chance?: number
        entry_loot?: string
        decoration_01?: string
        decoration_02?: string
    } & ({
        bridgeLandBounds: Collider[]
        bridgeWaterBounds: Collider[]
    } | Record<string, unknown>);

    export interface Structure extends ObstacleGroup {
        type: "structure"
        structureType?: string
        map?: {
            color: number
        }
        layers?: ObstacleReference[]
        stairs?: Array<{
            collision: Collider
            downDir: Point2D
            noCeilingReveal?: boolean
            lootOnly?: boolean
        }>
        mask?: Collider[]
        interiorSound?: {
            soundAlt: string
            filter: string
            transitionTime: number
            soundAltPlayTime: number
            outsideMaxDist: number
            outsideVolume: number
            undergroundVolume: number
            puzzle: string
            order?: string[]
        }
    }

    export interface LootTier {
        type: "loot_spawner"
        loot: Array<(LooseLoot & { props: { preloadGuns?: boolean } })>
        terrain?: {
            grass: boolean
            beach: boolean
            riverShore?: number
        }
    }

    export interface Decal {
        type: "decal"
        collision: Collider
        height: number
        lifetime?: number | {
            min: number
            max: number
        }
        fadeChance?: number
    }

    export type JSON = Record<string, Random | Obstacle | Wall | Building | Structure | LootTier | Decal>;
}

export namespace JSONConfig {
    type Region = "na" | "eu" | "as";
    interface ServerConfig {
        host: string
        port: number
        https: boolean
        webSocketHost: string
        webSocketPort: number
        webSocketHttps: boolean
        webSocketDevAddress: string
        useWebSocketDevAddress: boolean
        webSocketRegions: Record<Region, string>
        defaultRegion: Region
        keyFile: string
        certFile: string
        movementSpeed: number
        botProtection: boolean
        stopServerOnGameEnd: boolean
        debug: {
            disableMapGeneration: boolean
            fixedSpawnLocation: number[]
            disableRedZone: boolean
            disableStaticFileCache: boolean
        }
        diagonalSpeed: number
    }

    export type JSON = ServerConfig;

}

// todo all the other json files
