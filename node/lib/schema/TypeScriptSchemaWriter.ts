
import { JsonSchema } from "../JsonSchema";
import {
    ThingCharacteristic,
    ThingMethod,
    ThingParameter,
    ThingProperty,
    ThingSchema,
} from "../ThingSchema";

import * as fs from "mz/fs";

export = TypeScriptSchemaWriter;

/**
 * Writes thing schema specifications in TypeScript type-definition format.
 * A translator written in TypeScript can use the generated interface definitions
 * to have the compiler enforce proper implementation of thing schemas.
 */
class TypeScriptSchemaWriter {

    /**
     * Writes thing schemas to a TypeScript type-definition file.
     *
     * @param {ThingSchema[]} thingSchemas  One or more schemas to write
     * @param {string} filePath  Path to the target type-definition (.d.ts) file
     */
    public static async writeThingSchemasToFileAsync(
            thingSchemas: ThingSchema[], filePath: string): Promise<void> {
        let tsCode: string = TypeScriptSchemaWriter.writeThingSchemas(thingSchemas);
        await fs.writeFile(filePath, tsCode, "utf8");
    }

    /**
     * Writes thing schemas as TypeScript type-definitions.
     *
     * @param {ThingSchema[]} thingSchemas  One or more schemas to write
     * @returns {string} TypeScript type-definition code
     */
    public static writeThingSchemas(thingSchemas: ThingSchema[]): string {
        let ts = "// Generated by OpenT2T\n\n";

        thingSchemas.forEach((thingSchema: ThingSchema) => {
            let fullName = thingSchema.name;
            let className = fullName.substr(fullName.lastIndexOf(".") + 1);
            let ns = className.length < fullName.length ?
                    fullName.substr(0, fullName.length - className.length - 1) : null;
            if (ns) {
                ts += "namespace " + ns + " {\n\n";
            }

            ts += "  export interface " + className;

            if (thingSchema.references.length > 0) {
                ts += " extends " + thingSchema.references.join(", ");
            }

            ts += " {\n\n";

            thingSchema.properties.forEach((p: ThingProperty) => {
                ts += TypeScriptSchemaWriter.writeProperty(p) + "\n";
            });

            thingSchema.methods.forEach((m: ThingMethod) => {
                ts += TypeScriptSchemaWriter.writeMethod(m);
            });

            ts += "  }\n\n";

            if (ns) {
                ts += "}\n\n";
            }
        });

        return ts;
    }

    /**
     * Converts a JSON schema to a TypeScript type.
     */
    public static jsonSchemaToTypeScriptType(schema: JsonSchema): string {
        if (!schema || !schema.type) {
            return "any";
        }

        // TODO: Convert complex types
        switch (schema.type) {
            case "integer":
            case "number": return "number";
            case "string": return "string";
            case "boolean": return "boolean";
            case "array": return "array";
            default: return "any";
        }
    }

    private static writeProperty(property: ThingProperty): string {
        let comment = TypeScriptSchemaWriter.writeDescription(property);
        let type = TypeScriptSchemaWriter.jsonSchemaToTypeScriptType(property.propertyType);
        if (property.canRead && !property.canWrite) {
            return comment + "    readonly " + property.name + ": " + type + ";\n";
        } else if (property.canRead || property.canWrite) {
            // TypeScript doesn't support write-only property in interfaces.
            return comment + "    " + property.name + ": " + type + ";\n";
        } else {
            return "";
        }
    }

    private static writeMethod(method: ThingMethod): string {
        let comment = TypeScriptSchemaWriter.writeDescription(method);
        let parameters = "";
        let returnType = "void";

        method.parameters.forEach((p: ThingParameter) => {
            if (p.isOut) {
                if (returnType !== "void") {
                    throw new Error("Multiple out parameters are not supported");
                } else {
                    returnType = TypeScriptSchemaWriter.jsonSchemaToTypeScriptType(p.parameterType);
                }
            } else {
                if (parameters) {
                    parameters += ", ";
                }

                parameters += p.name + ": " +
                        TypeScriptSchemaWriter.jsonSchemaToTypeScriptType(p.parameterType);
            }
        });

        return comment + "    " + method.name + "(" + parameters + "): " + returnType + ";\n\n";
    }

    private static writeDescription(characteristic: ThingCharacteristic): string {
        if (!characteristic.description) {
            return "";
        }

        return "    /**\n     * " + characteristic.description + "\n     */\n";
    }
}
