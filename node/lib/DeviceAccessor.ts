
import { DeviceInterface } from "./DeviceInterface";
import { IDevice } from "./ITranslator";

import { EventEmitter } from "events";

/**
 * Provides reflection-style access to device properties and methods via device interfaces.
 */
export class DeviceAccessor {

    /**
     * Gets the value of a property on a device, using a specified interface.
     *
     * @param {IDevice} device  Device instance obtained from a translator
     * @param {(string | DeviceInterface)} interfaceName  Name of the interface used
     *     to access the device, or a DeviceInterface object
     * @param {string} propertyName  Name of the property to get
     * @returns {Promise<any>} Value returned by the property getter; the value is
     *     expected to conform to the JSON schema for the property as specified
     *     by the interface
     */
    public static async getPropertyAsync(
            device: IDevice,
            interfaceName: string | DeviceInterface,
            propertyName: string): Promise<any> {
        let deviceInterface = DeviceAccessor.getDeviceInterface(device, interfaceName);
        DeviceAccessor.validateMemberName(propertyName);

        let value: any = deviceInterface[propertyName];
        if (typeof value === "undefined") {
            let methodName = "get" + DeviceAccessor.capitalize(propertyName);
            let getPropertyMethod: any = deviceInterface[methodName];
            if (typeof getPropertyMethod === "function") {
                value = getPropertyMethod.call(deviceInterface);
            } else {
                getPropertyMethod = deviceInterface[methodName + "Async"];
                if (typeof getPropertyMethod === "function") {
                    value = getPropertyMethod.call(deviceInterface);
                }
            }
        }

        if (typeof value === "undefined") {
            throw new TypeError("Property '" + propertyName + "' getter " +
                "for interface " + interfaceName + " not implemented by device.");
        } else if (typeof value === "object" && typeof value.then === "function") {
            return await value;
        } else {
            return value;
        }
    }

    /**
     * Sets the value of a property on a device, using a specified interface.
     *
     * @param {IDevice} device  Device instance obtained from a translator
     * @param {(string | DeviceInterface)} interfaceName  Name of the interface used
     *     to access the device, or a DeviceInterface object
     * @param {string} propertyName  Name of the property to set
     * @param {*} value  Value passed to the property setter; the value is
     *     expected to conform to the JSON schema for the property as specified
     *     by the interface
     */
    public static async setPropertyAsync(
            device: IDevice,
            interfaceName: string | DeviceInterface,
            propertyName: string,
            value: any): Promise<void> {
        let deviceInterface = DeviceAccessor.getDeviceInterface(device, interfaceName);
        DeviceAccessor.validateMemberName(propertyName);

        let setPropertyMethod: any;
        let currentValue = deviceInterface[propertyName];
        if (typeof currentValue !== "undefined") {
            setPropertyMethod = function (newValue: any) { this[propertyName] = newValue; };
        } else {
            let methodName = "set" + DeviceAccessor.capitalize(propertyName);
            setPropertyMethod = deviceInterface[methodName];
            if (typeof setPropertyMethod !== "function") {
                setPropertyMethod = deviceInterface[methodName + "Async"];
                if (typeof setPropertyMethod !== "function") {
                    throw new TypeError("Property '" + propertyName + "' setter " +
                        "for interface " + interfaceName + " not implemented by device.");
                }
            }
        }

        let result = setPropertyMethod.call(deviceInterface, value);
        if (typeof result === "object" && typeof result.then === "function") {
            await result;
        }
    }

    /**
     * Adds a listener callback to a property that will be invoked if and when the
     * property sends notifications.
     *
     * @param {IDevice} device  Device instance obtained from a translator
     * @param {(string | DeviceInterface)} interfaceName  Name of the interface used
     *     to access the device, or a DeviceInterface object
     * @param {string} propertyName  Name of the property to listen to
     * @param {(value: any) => void} callback  Callback function that will be invoked
     *     if and when the property sends notifications; the callback takes a single
     *     parameter, which is expected to conform to the property schema as specified
     *     by the interface
     */
    public static addPropertyListener(
            device: IDevice,
            interfaceName: string | DeviceInterface,
            propertyName: string,
            callback: (value: any) => void): void {
        let deviceInterface = DeviceAccessor.getDeviceInterface(device, interfaceName);
        DeviceAccessor.validateMemberName(propertyName);

        // The "on" method is defined by the Node.js EventEmitter class,
        // which device classes inherit from if they implement notifications.
        let addListenerMethod: any = (<EventEmitter> deviceInterface).on;

        if (typeof addListenerMethod !== "function") {
            throw new TypeError("Property '" + propertyName + "' notifier " +
                "for interface " + interfaceName + " not implemented by device.");
        } else {
            addListenerMethod.call(deviceInterface, propertyName, callback);
        }
    }

    /**
     * Removes a listener callback that was previously added to a property.
     *
     * @param {IDevice} device  Device instance obtained from a translator
     * @param {(string | DeviceInterface)} interfaceName  Name of the interface used
     *     to access the device, or a DeviceInterface object
     * @param {string} propertyName  Name of the property that is being listened to
     * @param {(value: any) => void} callback  Callback function that was previously
     *     added as a listener to the same property on the same device
     */
    public static removePropertyListener(
            device: IDevice,
            interfaceName: string | DeviceInterface,
            propertyName: string,
            callback: (value: any) => void): void {
        let deviceInterface = DeviceAccessor.getDeviceInterface(device, interfaceName);
        DeviceAccessor.validateMemberName(propertyName);

        // The "removeListener" method is defined by the Node.js EventEmitter class,
        // which device classes inherit from if they implement notifications.
        let removeListenerMethod: any = (<EventEmitter> deviceInterface).removeListener;

        if (typeof removeListenerMethod !== "function") {
            throw new TypeError("Property '" + propertyName + "' notifier removal " +
                "for interface " + interfaceName + " not implemented by device.");
        } else {
            removeListenerMethod.call(deviceInterface, propertyName, callback);
        }
    }

    /**
     * Invokes a method on a device, using a specified interface.
     *
     * @param {IDevice} device  Device instance obtained from a translator
     * @param {(string | DeviceInterface)} interfaceName  Name of the interface used
     *     to access the device, or a DeviceInterface object
     * @param {string} methodName  Name of the method to invoke
     * @param {any[]} args  Arguments to pass to the method; the number and types of
     *     arguments are expected to conform to the interface definition of the method
     *     and the JSON schemas for each method argument in the interface.
     * @returns {Promise<any>} Value returned by the method, or undefined if the
     *     method has a void return type; the value is expected to conform to the
     *     JSON schema for the method return value as specified by the interface
     */
    public static async invokeMethodAsync(
            device: IDevice,
            interfaceName: string | DeviceInterface,
            methodName: string,
            args: any[]): Promise<any> {
        let deviceInterface = DeviceAccessor.getDeviceInterface(device, interfaceName);
        DeviceAccessor.validateMemberName(methodName);
        if (!Array.isArray(args)) {
            throw new TypeError("Args argument must be an array.");
        }

        let method: any = deviceInterface[methodName];
        if (typeof method !== "function") {
            throw new TypeError("Method '" + methodName + "' " +
                "for interface " + interfaceName + " not implemented by device.");
        } else {
            let result = method.apply(deviceInterface, args);
            if (typeof result === "object" && typeof result.then === "function") {
                return await result;
            } else {
                return result;
            }
        }
    }

    /**
     * Check for an `as` method on the device, and if found use it to request an object
     * that implements the specified interface.
     */
    private static getDeviceInterface(
            device: IDevice, interfaceName: string | DeviceInterface): {[key: string]: any} {
        if (typeof device !== "object") {
            throw new TypeError("Device argument must be an object.");
        }

        if (typeof device.as !== "function") {
            // The device doesn't implement an "as" method, so it is assumed to implement
            // all interface methods directly.
            return <{[key: string]: any}> device;
        }

        if (typeof interfaceName !== "string") {
            interfaceName = interfaceName.name;
        }

        let deviceInterface: Object | null = device.as(interfaceName);
        if (!deviceInterface) {
            throw new TypeError("Interface not implemented by device: " + interfaceName);
        }

        return <{[key: string]: any}> deviceInterface;
    }

    private static validateMemberName(memberName: string) {
        if (typeof memberName !== "string") {
            throw new TypeError("Member name argument must be a string.");
        }
        if (memberName.length === 0) {
            throw new TypeError("Member name argument must be nonempty.");
        }
    }

    private static capitalize(propertyName: string) {
        if (propertyName.length > 1) {
            return propertyName.substr(0, 1).toUpperCase() + propertyName.substr(1);
        }

        return propertyName;
    }
}
