import { EventEmitter } from '@pixi/utils';
import { Rectangle, Transform, RAD_TO_DEG, DEG_TO_RAD } from '@pixi/math';
import { Bounds } from './Bounds';
// _tempDisplayObjectParent = new DisplayObject();

/**
 * The base class for all objects that are rendered on the screen.
 *
 * This is an abstract class and should not be used on its own; rather it should be extended.
 *
 * @class
 * @extends PIXI.utils.EventEmitter
 * @memberof PIXI
 */
export class DisplayObject extends EventEmitter
{
    /**
     * Mixes all enumerable properties and methods from a source object to DisplayObject.
     *
     * @param {object} source The source of properties and methods to mix in.
     */
    static mixin(source)
    {
        // in ES8/ES2017, this would be really easy:
        // Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));

        // get all the enumerable property keys
        const keys = Object.keys(source);

        // loop through properties
        for (let i = 0; i < keys.length; ++i)
        {
            const propertyName = keys[i];

            // Set the property using the property descriptor - this works for accessors and normal value properties
            Object.defineProperty(
                DisplayObject.prototype,
                propertyName,
                Object.getOwnPropertyDescriptor(source, propertyName)
            );
        }
    }

    constructor()
    {
        super();

        this.tempDisplayObjectParent = null;

        // TODO: need to create Transform from factory
        this._transform = new Transform();

        this._alpha = 1;

        this._visible = true;

        this._renderable = true;

        /**
         * The display object container that contains this display object.
         *
         * @member {PIXI.Container}
         * @readonly
         */
        this.parent = null;

        /**
         * The multiplied alpha of the displayObject.
         *
         * @member {number}
         * @readonly
         */
        this.worldAlpha = 1;

        /**
         * Which index in the children array the display component was before the previous zIndex sort.
         * Used by containers to help sort objects with the same zIndex, by using previous array index as the decider.
         *
         * @member {number}
         * @protected
         */
        this._lastSortedIndex = 0;

        /**
         * The zIndex of the displayObject.
         * A higher value will mean it will be rendered on top of other displayObjects within the same container.
         *
         * @member {number}
         * @protected
         */
        this._zIndex = 0;

        /**
         * The area the filter is applied to. This is used as more of an optimization
         * rather than figuring out the dimensions of the displayObject each frame you can set this rectangle.
         *
         * Also works as an interaction mask.
         *
         * @member {?PIXI.Rectangle}
         */
        this.filterArea = null;

        /**
         * Sets the filters for the displayObject.
         * * IMPORTANT: This is a WebGL only feature and will be ignored by the canvas renderer.
         * To remove filters simply set this property to `'null'`.
         *
         * @member {?PIXI.Filter[]}
         */
        this.filters = null;
        this._enabledFilters = null;

        /**
         * The bounds object, this is used to calculate and store the bounds of the displayObject.
         *
         * @member {PIXI.Bounds}
         * @protected
         */
        this._bounds = new Bounds();
        this._boundsID = 0;
        this._lastBoundsID = -1;
        this._boundsRect = null;
        this._localBoundsRect = null;

        /**
         * The original, cached mask of the object.
         *
         * @member {PIXI.Graphics|PIXI.Sprite|null}
         * @protected
         */
        this._mask = null;

        /**
         * Fired when this DisplayObject is added to a Container.
         *
         * @event PIXI.DisplayObject#added
         * @param {PIXI.Container} container - The container added to.
         */

        /**
         * Fired when this DisplayObject is removed from a Container.
         *
         * @event PIXI.DisplayObject#removed
         * @param {PIXI.Container} container - The container removed from.
         */

        /**
         * If the object has been destroyed via destroy(). If true, it should not be used.
         *
         * @member {boolean}
         * @protected
         */
        this._destroyed = false;

        /**
         * used to fast check if a sprite is.. a sprite!
         * @member {boolean}
         */
        this.isSprite = false;

        /**
         * Does any other displayObject use this object as a mask?
         * @member {boolean}
         */
        this.isMask = false;
    }

    /**
     * World transform and local transform of this object.
     * This will become read-only later, please do not assign anything there unless you know what are you doing.
     *
     * @member {PIXI.Transform}
     */
    get transform() {
        return this._transform;
    }
    set transform(value) {
        window.pixiChanged = window.pixiChanged ||
        (this._transform.position.x !== value.position.x) ||
        (this._transform.position.y !== value.position.y) ||
        (this._transform.scale.x !== value.scale.x) ||
        (this._transform.scale.y !== value.scale.y) ||
        (this._transform.rotation !== value.rotation) ||
        (this._transform.skew.x !== value.skew.x) ||
        (this._transform.skew.y !== value.skew.y) ||
        (this._transform.pivot.x !== value.pivot.x) ||
        (this._transform.pivot.y !== value.pivot.y);
        this._transform = value;
    }

    /**
     * The visibility of the object. If false the object will not be drawn, and
     * the updateTransform function will not be called.
     *
     * Only affects recursive calls from parent. You can ask for bounds or call updateTransform manually.
     *
     * @member {boolean}
     */
    get visible()
    {
        return this._visible;
    }
    set visible(value) // eslint-disable-line require-jsdoc
    {
        window.pixiChanged = window.pixiChanged || (this._visible !== value);
        this._visible = value;
    }
    /**
     * Can this object be rendered, if false the object will not be drawn but the updateTransform
     * methods will still be called.
     *
     * Only affects recursive calls from parent. You can ask for bounds manually.
     *
     * @member {boolean}
     */
    get renderable()
    {
        return this._renderable;
    }
    set renderable(value) // eslint-disable-line require-jsdoc
    {
        window.pixiChanged = window.pixiChanged || (this._renderable !== value);
        this._renderable = value;
    }
    /**
     * The opacity of the object.
     *
     * @member {number}
     */
    get alpha()
    {
        return this._alpha;
    }
    set alpha(value) // eslint-disable-line require-jsdoc
    {
        window.pixiChanged = window.pixiChanged || (this._alpha !== value);
        this._alpha = value;
    }


    /**
     * @protected
     * @member {PIXI.DisplayObject}
     */
    get _tempDisplayObjectParent()
    {
        if (this.tempDisplayObjectParent === null)
        {
            this.tempDisplayObjectParent = new DisplayObject();
        }

        return this.tempDisplayObjectParent;
    }

    /**
     * Updates the object transform for rendering.
     *
     * TODO - Optimization pass!
     */
    updateTransform()
    {
        this._boundsID++;

        this.transform.updateTransform(this.parent.transform);
        // multiply the alphas..
        this.worldAlpha = this.alpha * this.parent.worldAlpha;
    }

    /**
     * Recalculates the bounds of the display object.
     *
     * Does nothing by default and can be overwritten in a parent class.
     */
    calculateBounds()
    {
        // OVERWRITE;
    }

    /**
     * Recursively updates transform of all objects from the root to this one
     * internal function for toLocal()
     */
    _recursivePostUpdateTransform()
    {
        if (this.parent)
        {
            this.parent._recursivePostUpdateTransform();
            this.transform.updateTransform(this.parent.transform);
        }
        else
        {
            this.transform.updateTransform(this._tempDisplayObjectParent.transform);
        }
    }

    /**
     * Retrieves the bounds of the displayObject as a rectangle object.
     *
     * @param {boolean} [skipUpdate] - Setting to `true` will stop the transforms of the scene graph from
     *  being updated. This means the calculation returned MAY be out of date BUT will give you a
     *  nice performance boost.
     * @param {PIXI.Rectangle} [rect] - Optional rectangle to store the result of the bounds calculation.
     * @return {PIXI.Rectangle} The rectangular bounding area.
     */
    getBounds(skipUpdate, rect)
    {
        if (!skipUpdate)
        {
            if (!this.parent)
            {
                this.parent = this._tempDisplayObjectParent;
                this.updateTransform();
                this.parent = null;
            }
            else
            {
                this._recursivePostUpdateTransform();
                this.updateTransform();
            }
        }

        if (this._boundsID !== this._lastBoundsID)
        {
            this.calculateBounds();
            this._lastBoundsID = this._boundsID;
        }

        if (!rect)
        {
            if (!this._boundsRect)
            {
                this._boundsRect = new Rectangle();
            }

            rect = this._boundsRect;
        }

        return this._bounds.getRectangle(rect);
    }

    /**
     * Retrieves the local bounds of the displayObject as a rectangle object.
     *
     * @param {PIXI.Rectangle} [rect] - Optional rectangle to store the result of the bounds calculation.
     * @return {PIXI.Rectangle} The rectangular bounding area.
     */
    getLocalBounds(rect)
    {
        const transformRef = this.transform;
        const parentRef = this.parent;

        this.parent = null;
        this.transform = this._tempDisplayObjectParent.transform;

        if (!rect)
        {
            if (!this._localBoundsRect)
            {
                this._localBoundsRect = new Rectangle();
            }

            rect = this._localBoundsRect;
        }

        const bounds = this.getBounds(false, rect);

        this.parent = parentRef;
        this.transform = transformRef;

        return bounds;
    }

    /**
     * Calculates the global position of the display object.
     *
     * @param {PIXI.IPoint} position - The world origin to calculate from.
     * @param {PIXI.IPoint} [point] - A Point object in which to store the value, optional
     *  (otherwise will create a new Point).
     * @param {boolean} [skipUpdate=false] - Should we skip the update transform.
     * @return {PIXI.IPoint} A point object representing the position of this object.
     */
    toGlobal(position, point, skipUpdate = false)
    {
        if (!skipUpdate)
        {
            this._recursivePostUpdateTransform();

            // this parent check is for just in case the item is a root object.
            // If it is we need to give it a temporary parent so that displayObjectUpdateTransform works correctly
            // this is mainly to avoid a parent check in the main loop. Every little helps for performance :)
            if (!this.parent)
            {
                this.parent = this._tempDisplayObjectParent;
                this.displayObjectUpdateTransform();
                this.parent = null;
            }
            else
            {
                this.displayObjectUpdateTransform();
            }
        }

        // don't need to update the lot
        return this.worldTransform.apply(position, point);
    }

    /**
     * Calculates the local position of the display object relative to another point.
     *
     * @param {PIXI.IPoint} position - The world origin to calculate from.
     * @param {PIXI.DisplayObject} [from] - The DisplayObject to calculate the global position from.
     * @param {PIXI.IPoint} [point] - A Point object in which to store the value, optional
     *  (otherwise will create a new Point).
     * @param {boolean} [skipUpdate=false] - Should we skip the update transform
     * @return {PIXI.IPoint} A point object representing the position of this object
     */
    toLocal(position, from, point, skipUpdate)
    {
        if (from)
        {
            position = from.toGlobal(position, point, skipUpdate);
        }

        if (!skipUpdate)
        {
            this._recursivePostUpdateTransform();

            // this parent check is for just in case the item is a root object.
            // If it is we need to give it a temporary parent so that displayObjectUpdateTransform works correctly
            // this is mainly to avoid a parent check in the main loop. Every little helps for performance :)
            if (!this.parent)
            {
                this.parent = this._tempDisplayObjectParent;
                this.displayObjectUpdateTransform();
                this.parent = null;
            }
            else
            {
                this.displayObjectUpdateTransform();
            }
        }

        // simply apply the matrix..
        return this.worldTransform.applyInverse(position, point);
    }

    /**
     * Renders the object using the WebGL renderer.
     *
     * @param {PIXI.Renderer} renderer - The renderer.
     */
    render(renderer) // eslint-disable-line no-unused-vars
    {
        // OVERWRITE;
    }

    /**
     * Set the parent Container of this DisplayObject.
     *
     * @param {PIXI.Container} container - The Container to add this DisplayObject to.
     * @return {PIXI.Container} The Container that this DisplayObject was added to.
     */
    setParent(container)
    {
        if (!container || !container.addChild)
        {
            throw new Error('setParent: Argument must be a Container');
        }

        container.addChild(this);

        return container;
    }

    /**
     * Convenience function to set the position, scale, skew and pivot at once.
     *
     * @param {number} [x=0] - The X position
     * @param {number} [y=0] - The Y position
     * @param {number} [scaleX=1] - The X scale value
     * @param {number} [scaleY=1] - The Y scale value
     * @param {number} [rotation=0] - The rotation
     * @param {number} [skewX=0] - The X skew value
     * @param {number} [skewY=0] - The Y skew value
     * @param {number} [pivotX=0] - The X pivot value
     * @param {number} [pivotY=0] - The Y pivot value
     * @return {PIXI.DisplayObject} The DisplayObject instance
     */
    setTransform(x = 0, y = 0, scaleX = 1, scaleY = 1, rotation = 0, skewX = 0, skewY = 0, pivotX = 0, pivotY = 0)
    {
        window.pixiChanged = window.pixiChanged ||
            (this.position.x !== x) ||
            (this.position.y !== y) ||
            (this.scale.x !== (!scaleX ? 1 : scaleX)) ||
            (this.scale.y !== (!scaleY ? 1 : scaleY)) ||
            (this.rotation !== rotation) ||
            (this.skew.x !== skewX) ||
            (this.skew.y !== skewY) ||
            (this.pivot.x !== pivotX) ||
            (this.pivot.y !== pivotY);

        this.position.x = x;
        this.position.y = y;
        this.scale.x = !scaleX ? 1 : scaleX;
        this.scale.y = !scaleY ? 1 : scaleY;
        this.rotation = rotation;
        this.skew.x = skewX;
        this.skew.y = skewY;
        this.pivot.x = pivotX;
        this.pivot.y = pivotY;

        return this;
    }

    /**
     * Base destroy method for generic display objects. This will automatically
     * remove the display object from its parent Container as well as remove
     * all current event listeners and internal references. Do not use a DisplayObject
     * after calling `destroy()`.
     *
     */
    destroy()
    {
        if (this.parent)
        {
            this.parent.removeChild(this);
        }
        this.removeAllListeners();
        this.transform = null;

        this.parent = null;
        this._bounds = null;
        this._currentBounds = null;
        this._mask = null;

        this.filters = null;
        this.filterArea = null;
        this.hitArea = null;

        this.interactive = false;
        this.interactiveChildren = false;

        this._destroyed = true;
    }

    /**
     * The position of the displayObject on the x axis relative to the local coordinates of the parent.
     * An alias to position.x
     *
     * @member {number}
     */
    get x()
    {
        return this.position.x;
    }

    set x(value) // eslint-disable-line require-jsdoc
    {
        window.pixiChanged = window.pixiChanged || (this.transform.position.x !== value);
        this.transform.position.x = value;
    }

    /**
     * The position of the displayObject on the y axis relative to the local coordinates of the parent.
     * An alias to position.y
     *
     * @member {number}
     */
    get y()
    {
        return this.position.y;
    }

    set y(value) // eslint-disable-line require-jsdoc
    {
        window.pixiChanged = window.pixiChanged || (this.transform.position.y !== value);
        this.transform.position.y = value;
    }

    /**
     * Current transform of the object based on world (parent) factors.
     *
     * @member {PIXI.Matrix}
     * @readonly
     */
    get worldTransform()
    {
        return this.transform.worldTransform;
    }

    /**
     * Current transform of the object based on local factors: position, scale, other stuff.
     *
     * @member {PIXI.Matrix}
     * @readonly
     */
    get localTransform()
    {
        return this.transform.localTransform;
    }

    /**
     * The coordinate of the object relative to the local coordinates of the parent.
     * Assignment by value since pixi-v4.
     *
     * @member {PIXI.IPoint}
     */
    get position()
    {
        return this.transform.position;
    }

    set position(value) // eslint-disable-line require-jsdoc
    {
        window.pixiChanged = window.pixiChanged || (!this.transform.position.equals(value));
        this.transform.position.copyFrom(value);
    }

    /**
     * The scale factor of the object.
     * Assignment by value since pixi-v4.
     *
     * @member {PIXI.IPoint}
     */
    get scale()
    {
        return this.transform.scale;
    }

    set scale(value) // eslint-disable-line require-jsdoc
    {
        window.pixiChanged = window.pixiChanged || (!this.transform.scale.equals(value));
        this.transform.scale.copyFrom(value);
    }

    /**
     * The pivot point of the displayObject that it rotates around.
     * Assignment by value since pixi-v4.
     *
     * @member {PIXI.IPoint}
     */
    get pivot()
    {
        return this.transform.pivot;
    }

    set pivot(value) // eslint-disable-line require-jsdoc
    {
        window.pixiChanged = window.pixiChanged || (!this.transform.pivot.equals(value));
        this.transform.pivot.copyFrom(value);
    }

    /**
     * The skew factor for the object in radians.
     * Assignment by value since pixi-v4.
     *
     * @member {PIXI.ObservablePoint}
     */
    get skew()
    {
        return this.transform.skew;
    }

    set skew(value) // eslint-disable-line require-jsdoc
    {
        window.pixiChanged = window.pixiChanged || (!this.transform.skew.equals(value));
        this.transform.skew.copyFrom(value);
    }

    /**
     * The rotation of the object in radians.
     * 'rotation' and 'angle' have the same effect on a display object; rotation is in radians, angle is in degrees.
     *
     * @member {number}
     */
    get rotation()
    {
        return this.transform.rotation;
    }

    set rotation(value) // eslint-disable-line require-jsdoc
    {
        window.pixiChanged = window.pixiChanged || (this.transform.rotation !== value);
        this.transform.rotation = value;
    }

    /**
     * The angle of the object in degrees.
     * 'rotation' and 'angle' have the same effect on a display object; rotation is in radians, angle is in degrees.
     *
     * @member {number}
     */
    get angle()
    {
        return this.transform.rotation * RAD_TO_DEG;
    }

    set angle(value) // eslint-disable-line require-jsdoc
    {
        window.pixiChanged = window.pixiChanged || (this.transform.rotation !== (value * DEG_TO_RAD));
        this.transform.rotation = value * DEG_TO_RAD;
    }

    /**
     * The zIndex of the displayObject.
     * If a container has the sortableChildren property set to true, children will be automatically
     * sorted by zIndex value; a higher value will mean it will be moved towards the end of the array,
     * and thus rendered on top of other displayObjects within the same container.
     *
     * @member {number}
     */
    get zIndex()
    {
        return this._zIndex;
    }

    set zIndex(value) // eslint-disable-line require-jsdoc
    {
        window.pixiChanged = window.pixiChanged || (this._zIndex !== value);
        this._zIndex = value;
        if (this.parent)
        {
            this.parent.sortDirty = true;
        }
    }

    /**
     * Indicates if the object is globally visible.
     *
     * @member {boolean}
     * @readonly
     */
    get worldVisible()
    {
        let item = this;

        do
        {
            if (!item.visible)
            {
                return false;
            }

            item = item.parent;
        } while (item);

        return true;
    }

    /**
     * Sets a mask for the displayObject. A mask is an object that limits the visibility of an
     * object to the shape of the mask applied to it. In PixiJS a regular mask must be a
     * {@link PIXI.Graphics} or a {@link PIXI.Sprite} object. This allows for much faster masking in canvas as it
     * utilities shape clipping. To remove a mask, set this property to `null`.
     *
     * For sprite mask both alpha and red channel are used. Black mask is the same as transparent mask.
     * @example
     * const graphics = new PIXI.Graphics();
     * graphics.beginFill(0xFF3300);
     * graphics.drawRect(50, 250, 100, 100);
     * graphics.endFill();
     *
     * const sprite = new PIXI.Sprite(texture);
     * sprite.mask = graphics;
     * @todo At the moment, PIXI.CanvasRenderer doesn't support PIXI.Sprite as mask.
     *
     * @member {PIXI.Container|PIXI.MaskData}
     */
    get mask()
    {
        return this._mask;
    }

    set mask(value) // eslint-disable-line require-jsdoc
    {
        window.pixiChanged = window.pixiChanged || (true);
        if (this._mask)
        {
            const maskObject = this._mask.maskObject || this._mask;

            maskObject.renderable = true;
            maskObject.isMask = false;
        }

        this._mask = value;

        if (this._mask)
        {
            const maskObject = this._mask.maskObject || this._mask;

            maskObject.renderable = false;
            maskObject.isMask = true;
        }
    }
}

/**
 * DisplayObject default updateTransform, does not update children of container.
 * Will crash if there's no parent element.
 *
 * @memberof PIXI.DisplayObject#
 * @function displayObjectUpdateTransform
 */
DisplayObject.prototype.displayObjectUpdateTransform = DisplayObject.prototype.updateTransform;
