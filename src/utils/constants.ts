import { TypeToId } from "./data";

export const AmmoTypes = ["9mm", "762mm", "556mm", "12gauge", "50AE", "308sub", "flare", "45acp"];
export const MedTypes = ["bandage", "healthkit", "soda", "painkiller"];
export const ScopeTypes = ["1xscope", "2xscope", "4xscope", "8xscope", "15xscope"];

// use enums?
export const Constants = {
    BasePack: TypeToId.backpack00 as number,
    BaseHelmet: TypeToId.helmet01 - 1,
    BaseChest: TypeToId.chest01 - 1,
    protocolVersion: 76,
    Input: {
        MoveLeft: 0,
        MoveRight: 1,
        MoveUp: 2,
        MoveDown: 3,
        Fire: 4,
        Reload: 5,
        Cancel: 6,
        Interact: 7,
        Revive: 8,
        Use: 9,
        Loot: 10,
        EquipPrimary: 11,
        EquipSecondary: 12,
        EquipMelee: 13,
        EquipThrowable: 14,
        EquipFragGrenade: 15,
        EquipSmokeGrenade: 16,
        EquipNextWeap: 17,
        EquipPrevWeap: 18,
        EquipLastWeap: 19,
        EquipOtherGun: 20,
        EquipPrevScope: 21,
        EquipNextScope: 22,
        UseBandage: 23,
        UseHealthKit: 24,
        UseSoda: 25,
        UsePainkiller: 26,
        StowWeapons: 27,
        SwapWeapSlots: 28,
        ToggleMap: 29,
        CycleUIMode: 30,
        EmoteMenu: 31,
        TeamPingMenu: 32,
        Fullscreen: 33,
        HideUI: 34,
        TeamPingSingle: 35,
        Count: 36
    },
    EmoteSlot: {
        Top: 0,
        Right: 1,
        Bottom: 2,
        Left: 3,
        Win: 4,
        Death: 5,
        Count: 6
    },
    WeaponSlot: {
        Primary: 0,
        Secondary: 1,
        Melee: 2,
        Throwable: 3,
        Count: 4
    },
    WeaponType: ["gun", "gun", "melee", "throwable"],
    DamageType: {
        Player: 0,
        Bleeding: 1,
        Gas: 2,
        Airdrop: 3,
        Airstrike: 4
    },
    Action: {
        None: 0,
        Reload: 1,
        ReloadAlt: 2,
        UseItem: 3,
        Revive: 4
    },
    Anim: {
        None: 0,
        Melee: 1,
        Cook: 2,
        Throw: 3,
        CrawlForward: 4,
        CrawlBackward: 5,
        Revive: 6
    },
    GasMode: {
        Inactive: 0,
        Waiting: 1,
        Moving: 2
    },
    Plane: {
        Airdrop: 0,
        Airstrike: 1
    },
    map: {
        gridSize: 16,
        shoreVariation: 3,
        grassVariation: 2
    },
    player: {
        radius: 1,
        maxVisualRadius: 3.75,
        maxInteractionRad: 3.5,
        health: 100,
        reviveHealth: 24,
        boostBreakpoints: [1, 1, 1.5, 0.5],
        baseSwitchDelay: 0.25,
        freeSwitchCooldown: 1,
        bleedTickRate: 1,
        reviveDuration: 8,
        reviveRange: 5,
        crawlTime: 0.75,
        emoteSoftCooldown: 2,
        emoteHardCooldown: 6,
        emoteThreshold: 6,
        throwableMaxMouseDist: 18,
        cookTime: 0.1,
        throwTime: 0.3,
        meleeHeight: 0.25,
        touchLootRadMult: 1.4,
        medicHealRange: 8,
        medicReviveRange: 6
    },
    defaultEmoteLoadout: ["emote_happyface", "emote_thumbsup", "emote_surviv", "emote_sadface", "", ""],
    airdrop: {
        actionOffset: 0,
        fallTime: 8,
        crushDamage: 100,
        planeVel: 48,
        planeRad: 150,
        soundRangeMult: 2.5,
        soundRangeDelta: 0.25,
        soundRangeMax: 92,
        fallOff: 0
    },
    airstrike: {
        actionOffset: 0,
        bombJitter: 4,
        bombOffset: 2,
        bombVel: 3,
        bombCount: 20,
        planeVel: 350,
        planeRad: 120,
        soundRangeMult: 18,
        soundRangeDelta: 18,
        soundRangeMax: 48,
        fallOff: 1.25
    },
    bullet: {
        maxReflect: 3,
        reflectDistDecay: 1.5,
        height: 0.25
    },
    projectile: {
        maxHeight: 5
    },
    structureLayerCount: 2,
    scopeZoomRadius: {
        desktop: {
            "1xscope": 28,
            "2xscope": 36,
            "4xscope": 48,
            "8xscope": 68,
            "15xscope": 104
        },
        mobile: {
            "1xscope": 32,
            "2xscope": 40,
            "4xscope": 48,
            "8xscope": 64,
            "15xscope": 88
        }
    },
    // I know this is how surviv natively handles it,
    // but for the sake of ease of extension, this system
    // might be worth re-engineering
    bagSizes: {
        "9mm": [120, 240, 330, 420],
        "762mm": [90, 180, 240, 300],
        "556mm": [90, 180, 240, 300],
        "12gauge": [15, 30, 60, 90],
        "50AE": [49, 98, 147, 196],
        "308sub": [10, 20, 40, 80],
        flare: [2, 4, 6, 8],
        "45acp": [90, 180, 240, 300],
        frag: [3, 6, 9, 12],
        smoke: [3, 6, 9, 12],
        strobe: [2, 3, 4, 5],
        mirv: [2, 4, 6, 8],
        snowball: [10, 20, 30, 40],
        potato: [10, 20, 30, 40],
        bandage: [5, 10, 15, 30],
        healthkit: [1, 2, 3, 4],
        soda: [2, 5, 10, 15],
        painkiller: [1, 2, 3, 4],
        "1xscope": [1, 1, 1, 1],
        "2xscope": [1, 1, 1, 1],
        "4xscope": [1, 1, 1, 1],
        "8xscope": [1, 1, 1, 1],
        "15xscope": [1, 1, 1, 1]
    },
    chestDamageReductionPercentages: [0, 0.25, 0.38, 0.45, 0.60],
    helmetDamageReductionPercentages: [0, 0.075, 0.12, 0.165, 0.21],
    lootRadius: {
        outfit: 1,
        melee: 1.25,
        gun: 1.25,
        throwable: 1,
        ammo: 1.2,
        heal: 1,
        boost: 1,
        backpack: 1,
        helmet: 1,
        chest: 1,
        scope: 1,
        perk: 1.25,
        xp: 1
    },
    MapNameMaxLen: 24,
    PlayerNameMaxLen: 16,
    MouseMaxDist: 64,
    SmokeMaxRad: 10,
    ActionMaxDuration: 8.5,
    AirstrikeZoneMaxRad: 256,
    AirstrikeZoneMaxDuration: 60,
    PlayerMinScale: 0.75,
    PlayerMaxScale: 2,
    MapObjectMinScale: 0.125,
    MapObjectMaxScale: 2.5,
    MaxPerks: 8,
    MaxMapIndicators: 16
};

export type Orientation = 0 | 1 | 2 | 3;

export enum ObjectKind {
    Invalid, Player, Obstacle, Loot,
    LootSpawner, DeadBody, Building, Structure,
    Decal, Projectile, Smoke, Airdrop
}

export enum MsgType {
    None, Join, Disconnect, Input, Edit,
    Joined, Update, Kill, GameOver, Pickup,
    Map, Spectate, DropItem, Emote, PlayerStats,
    AdStatus, Loadout, RoleAnnouncement, Stats,
    UpdatePass, AliveCounts, PerkModeRoleSelect,
    GamePlayerStats, BattleResults
}

export enum InputType {
    MoveLeft, MoveRight, MoveUp, MoveDown,
    Fire, Reload, Cancel, Interact, Revive,
    Use, Loot, EquipPrimary, EquipSecondary,
    EquipMelee, EquipThrowable, EquipFragGrenade,
    EquipSmokeGrenade, EquipNextWeap, EquipPrevWeap,
    EquipLastWeap, EquipOtherGun, EquipPrevScope,
    EquipNextScope, UseBandage, UseHealthKit,
    UseSoda, UsePainkiller, StowWeapons, SwapWeapSlots,
    ToggleMap, CycleUIMode, EmoteMenu, TeamPingMenu,
    Fullscreen, HideUI, TeamPingSingle, UseEventItem
}

export enum DamageType {
    Player, Bleeding, Gas, Airdrop, Airstrike,
}

export enum WeaponType {
    Gun, Melee, Throwable
}

export enum ItemSlot {
    Primary, Secondary, Melee, Throwable
}

export enum CollisionType {
    Circle, Rectangle
}

export enum CollisionCategory {
    // use bit shifts for added clarity + intent?
    Player = 2, Obstacle = 4, Loot = 8, Other = 16
}
