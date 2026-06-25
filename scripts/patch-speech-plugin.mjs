// Hace que @capacitor-community/speech-recognition (que solo trae soporte
// CocoaPods) funcione en este proyecto, que usa Swift Package Manager.
//
// El plugin no trae Package.swift y registra sus métodos con una macro ObjC
// (Plugin.m), algo que SPM no admite mezclado con Swift. Este script:
//   1. Le agrega un Package.swift (compila solo el Swift, excluye el ObjC).
//   2. Convierte el registro a Swift puro (conformidad CAPBridgedPlugin).
//
// Se ejecuta en cada `npm install` (postinstall) para que el parche persista
// aunque se reinstale node_modules. Es idempotente.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pluginDir = join(root, 'node_modules', '@capacitor-community', 'speech-recognition');

if (!existsSync(pluginDir)) {
    // El plugin no está instalado: nada que parchear.
    process.exit(0);
}

const PACKAGE_SWIFT = `// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "CapacitorCommunitySpeechRecognition",
    platforms: [.iOS(.v14)],
    products: [
        .library(
            name: "CapacitorCommunitySpeechRecognition",
            targets: ["SpeechRecognitionPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0")
    ],
    targets: [
        .target(
            name: "SpeechRecognitionPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ],
            path: "ios/Plugin",
            exclude: ["Plugin.m", "Plugin.h", "Info.plist"])
    ]
)
`;

const BRIDGED = `@objc(SpeechRecognition)
public class SpeechRecognition: CAPPlugin, CAPBridgedPlugin {

    public let identifier = "SpeechRecognition"
    public let jsName = "SpeechRecognition"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "available", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getSupportedLanguages", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isListening", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "checkPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermissions", returnType: CAPPluginReturnPromise)
    ]

    let defaultMatches = 5`;

const ORIGINAL = `@objc(SpeechRecognition)
public class SpeechRecognition: CAPPlugin {

    let defaultMatches = 5`;

// 1. Package.swift
const pkgPath = join(pluginDir, 'Package.swift');
writeFileSync(pkgPath, PACKAGE_SWIFT);

// 2. Registro Swift (CAPBridgedPlugin)
const swiftPath = join(pluginDir, 'ios', 'Plugin', 'Plugin.swift');
let swift = readFileSync(swiftPath, 'utf8');
if (!swift.includes('CAPBridgedPlugin')) {
    if (swift.includes(ORIGINAL)) {
        swift = swift.replace(ORIGINAL, BRIDGED);
        writeFileSync(swiftPath, swift);
        console.log('[patch-speech-plugin] Registro Swift aplicado.');
    } else {
        console.warn('[patch-speech-plugin] AVISO: no encontré el bloque esperado en Plugin.swift; revisa si el plugin cambió de versión.');
    }
}
console.log('[patch-speech-plugin] Package.swift listo para SPM.');
