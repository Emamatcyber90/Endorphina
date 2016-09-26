/*
    simple slot machine - like demo by Martin Svatek
*/

// note: not embedded in IIFE for easier debugging

const FOURKINGS = {
// description of geometry of supplied game files
    width: 1536,
    height: 1024,
    tileSize: 222,
    background: "images/4OfAKing_slot_background_2.png",
    slots: {
        y: 142, // ends 807, size 3 * 222
        x: [169, 413, 657, 901, 1145]
        // x: [[169, 390], [413, 634], [657, 878], [901, 1122], [1145, 1366]] // 222
    },
    sprites: [ // all 222x222
        "images/01_01.png",
        "images/03_01.png",
        "images/04_symbol_01.png",
        "images/05_01.png",
        "images/scatter.png",
        "images/symbol_06_01.png"
    ]
};


function SlotGame(domId, desc) {
// initializes internal state of the demo slot machine, preloads sprites
    const self = this;

    this.desc = desc;

    this.renderer = PIXI.autoDetectRenderer(this.desc.width, this.desc.height,
        {view: document.getElementById(domId), antialias: true, resolution: 1});

    this.stage = new PIXI.Container();

    // for reel movement phases
    this.state = this.phase1;
    this.ticks = 0;
    this.slot = 0;
    this.slotTicks = 0;
    this.nearestY = 0;

    this.desc.sprites.reduce((loader, path) => loader.add(path), PIXI.loader.add(desc.background))
    // chainloades all paths in desc.sprites array, passes the loader (initially "loaded" with background)
        .load(() => self.setup.call(self)); // correct "this"
}


function shuffle(array) {
// Fisher Yates alg., shuffles randomly content of an array, returns reference
    let n = array.length;
    for (let i = 0; i < n - 1; i ++) {
        let j = Math.floor(Math.random() * (n - i)) + i;
        const tmp = array[i];
        array[i] = array[j];
        array[j] = tmp;
    }
    return array;
}


SlotGame.prototype.setup = function() {
// displays background, creates reel sprites from item sprites for slots & masks
    const self = this;
    const resources = PIXI.loader.resources;

    // background
    this.stage.addChild(new PIXI.Sprite(resources[this.desc.background].texture));

    // the order of items in reel sprite is: 0 | 1 (2) 3 | 4 5 0 | 1 (2) 3 | 4 = 6 + 5
    // rationale: we need the whole way from one number (2) to the same num again + 2 edges (0/4) for bumps
    const spriteCount = this.desc.sprites.length;
    const itemCount = spriteCount + 5; // 5 is for slot of size 3
    const slotCount = this.desc.slots.x.length;

    this.slotSprites = new Array(slotCount);
    this.endY = this.desc.tileSize; // bump can go up to 1 tile backwards
    this.startY = this.desc.tileSize * (itemCount - 4); // 3 for reel + 1 for bump

    // reel sprites = 1 big sprite for each slot made from randomly shuffled tile sprites
    for (let x = 0; x < slotCount; x++) {
        const slot = PIXI.RenderTexture.create(this.desc.tileSize, itemCount * this.desc.tileSize);
        const container = new PIXI.Container();
        const rndArray = shuffle([...Array(spriteCount).keys()]); // used for randomizing each reel

        for (let y = 0; y < itemCount; y++) {
            const modY = rndArray[y % this.desc.sprites.length];
            const sprite = new PIXI.Sprite(resources[this.desc.sprites[modY]].texture);
            sprite.y = y * this.desc.tileSize;
            container.addChild(sprite);
        }
        this.renderer.render(container, slot);
        const slotSprite = new PIXI.Sprite(slot);

        // reel sprite, movement = changing pivot.y
        slotSprite.x = this.desc.slots.x[x];
        slotSprite.y = this.desc.slots.y;
        slotSprite.pivot.y = this.startY;

        this.stage.addChild(slotSprite);
        this.slotSprites[x] = slotSprite;

        // slot mask
        const mask = new PIXI.Graphics();
        mask.beginFill();
        mask.drawRect(this.desc.slots.x[x], this.desc.slots.y, this.desc.tileSize, 3 * this.desc.tileSize);
        mask.endFill();
        this.stage.addChild(mask);

        // apply mask
        slotSprite.mask = mask;
    }

    // fire up the animation
    requestAnimationFrame(() => self.animate.call(self));
};


SlotGame.prototype.wrap = function(y) {
// utility function for ensuring smooth slot sprite alignment
    if (y < this.endY) return (this.startY - (this.endY - y)); else return y;
};


SlotGame.prototype.phase1 = function() {
// initial delay
    const delay  = 30;
    if (this.ticks > delay) {
        this.ticks = 0;
        this.state = this.phase2;
    }
};


SlotGame.prototype.phase2 = function() {
// initial bump
    const delay = 12;
    const amount = 1 / 7;

    if (this.ticks > delay) {
        this.ticks = 0;
        this.state = this.phase3;
    }
    for (let i = 0; i < this.slotSprites.length; i++) {
        let y = this.slotSprites[i].pivot.y;
        y = Math.floor(y + this.desc.tileSize * amount / delay); // just linear
        this.slotSprites[i].pivot.y = y;
    }
};


SlotGame.prototype.phase3 = function() {
// full speed rotation
    const delay = 90;
    const speed = 40;

    if (this.ticks > delay) {
        this.ticks = 0;
        this.state = this.phase4;
        this.slot = 0;
        this.slotTicks = 0;
    }
    for (let i = 0; i < this.slotSprites.length; i++) {
        this.slotSprites[i].pivot.y = this.wrap(this.slotSprites[i].pivot.y - speed);
    }
};


SlotGame.prototype.phase4 = function() {
// ending phase, starting with slot 0, progressing each X ticks to next slot
// ending at tile boundary must be ensured
    const delay = 45;
    const bumpDelay = 15; // must be safely < delay (15 + 5 < 45)
    const speed = 40;
    const amplitude = this.desc.tileSize / 7;

    if (this.ticks > delay) { // next slot if time is up or phase1 again if all slots done
        this.ticks = 0;
        if (this.slot == this.slotSprites.length - 1) {
            this.state = this.phase1;
            return; // immediately; this.slot += 1 below would make troubles
        }
        this.slot += 1;
        this.slotTicks = 0;
    }

    // stop current slot bump-style:
    // if we're far from nearest 222, let's get there first (at 40 speed it should take 5 ticks max)
    if (!this.slotTicks) { // serves as a switch also, 0 = not bumping yet, anything else = bumping
        const y = this.slotSprites[this.slot].pivot.y;
        const nearestY = y - (y % this.desc.tileSize); // this should never by < this.endY
        if (y - speed > nearestY) { // we're far
            this.slotSprites[this.slot].pivot.y = this.wrap(y - speed); // wrap should not be needed
        } else { // we're near, we'll start performing bump next tick
            this.slotTicks = 1;
            this.nearestY = nearestY;
            this.slotSprites[this.slot].pivot.y = this.nearestY;
        }
    } else if (this.slotTicks <= bumpDelay) { // bump
        const bump = Math.round((1 - this.slotTicks / bumpDelay) * Math.abs(amplitude * Math.sin(2 * Math.PI * this.slotTicks / bumpDelay))); // should return 0 for this.slotTicks == bumpDelay

        this.slotSprites[this.slot].pivot.y = this.nearestY + bump;
        this.slotTicks += 1;
    }

    // rotate rest of the slots at full speed meanwhile
    for (let i = this.slot + 1; i < this.slotSprites.length; i++) {
        this.slotSprites[i].pivot.y = this.wrap(this.slotSprites[i].pivot.y - speed);
    }
};



SlotGame.prototype.animate = function() {
    const self = this;

    this.ticks += 1;
    this.state();
    this.renderer.render(this.stage);

    requestAnimationFrame(() => self.animate.call(self));
};


const game = new SlotGame("pane", FOURKINGS);

