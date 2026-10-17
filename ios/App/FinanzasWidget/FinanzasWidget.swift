import WidgetKit
import SwiftUI

// Widget de Finanzas 360: saldo disponible, gasto de hoy y del mes, y acceso directo
// para registrar un gasto. Los datos los escribe la app (WidgetBridgePlugin) en el
// App Group; el widget no consulta la red.

private let appGroup = "group.com.finanzas360.app"
private let urlGasto = URL(string: "finanzas360://gasto")!
private let urlInicio = URL(string: "finanzas360://inicio")!

// MARK: - Datos

struct Resumen {
    var saldo: Double
    var gastoHoy: Double
    var gastoMes: Double
    var proximoPago: String
    var actualizado: Date?

    static let vacio = Resumen(saldo: 0, gastoHoy: 0, gastoMes: 0, proximoPago: "", actualizado: nil)
    static let ejemplo = Resumen(saldo: 1_712_809, gastoHoy: 62_000, gastoMes: 4_252_990, proximoPago: "Tarjeta · 20 oct", actualizado: Date())

    static func leer() -> Resumen {
        guard let d = UserDefaults(suiteName: appGroup)?.dictionary(forKey: "resumen") else { return .vacio }
        let ts = d["actualizado"] as? Double
        return Resumen(
            saldo: d["saldo"] as? Double ?? 0,
            gastoHoy: d["gastoHoy"] as? Double ?? 0,
            gastoMes: d["gastoMes"] as? Double ?? 0,
            proximoPago: d["proximoPago"] as? String ?? "",
            actualizado: ts.map { Date(timeIntervalSince1970: $0) }
        )
    }

    // Los acumulados del día y del mes dejan de valer cuando cambia el día o el mes.
    func vigente(en fecha: Date) -> Resumen {
        guard let act = actualizado else { return self }
        var r = self
        let cal = Calendar.current
        if !cal.isDate(act, inSameDayAs: fecha) { r.gastoHoy = 0 }
        if !cal.isDate(act, equalTo: fecha, toGranularity: .month) { r.gastoMes = 0 }
        return r
    }

    var sinDatos: Bool { actualizado == nil }
}

struct Entrada: TimelineEntry {
    let date: Date
    let resumen: Resumen
}

struct Proveedor: TimelineProvider {
    func placeholder(in context: Context) -> Entrada { Entrada(date: Date(), resumen: .ejemplo) }

    func getSnapshot(in context: Context, completion: @escaping (Entrada) -> Void) {
        let r = Resumen.leer()
        completion(Entrada(date: Date(), resumen: context.isPreview && r.sinDatos ? .ejemplo : r))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Entrada>) -> Void) {
        let ahora = Date()
        let r = Resumen.leer()
        let medianoche = Calendar.current.startOfDay(for: ahora.addingTimeInterval(86_400))
        // Hoy, y desde medianoche con el gasto del día en cero. La app pide recargar cada vez que cambia algo.
        let entradas = [Entrada(date: ahora, resumen: r.vigente(en: ahora)),
                        Entrada(date: medianoche, resumen: r.vigente(en: medianoche))]
        completion(Timeline(entries: entradas, policy: .after(medianoche.addingTimeInterval(86_400))))
    }
}

// MARK: - Formato

private let formatoCOP: NumberFormatter = {
    let f = NumberFormatter()
    f.numberStyle = .decimal
    f.locale = Locale(identifier: "es_CO")
    f.maximumFractionDigits = 0
    return f
}()

func cop(_ v: Double) -> String {
    let n = formatoCOP.string(from: NSNumber(value: abs(v).rounded())) ?? "0"
    return (v < 0 ? "−$ " : "$ ") + n
}

// Versión corta para espacios pequeños: $1,7 M · $62 mil.
func copCorto(_ v: Double) -> String {
    let a = abs(v)
    let signo = v < 0 ? "−" : ""
    if a >= 1_000_000 {
        let m = (a / 100_000).rounded() / 10
        return "\(signo)$\(m.formatted(.number.locale(Locale(identifier: "es_CO")).precision(.fractionLength(0...1)))) M"
    }
    if a >= 1_000 { return "\(signo)$\(Int((a / 1_000).rounded())) mil" }
    return "\(signo)$\(Int(a))"
}

// MARK: - Colores F360

extension Color {
    static let f360Primary = Color(red: 0x33 / 255, green: 0x55 / 255, blue: 0xFF / 255)
    static let f360Navy = Color(red: 0x0B / 255, green: 0x12 / 255, blue: 0x20 / 255)
    static let f360Expense = Color(red: 0xFD / 255, green: 0xA4 / 255, blue: 0xAF / 255)
    static let f360Cyan = Color(red: 0x22 / 255, green: 0xD3 / 255, blue: 0xEE / 255)
}

struct FondoHero: View {
    var body: some View {
        ZStack {
            LinearGradient(colors: [Color.f360Navy, Color(red: 0.08, green: 0.12, blue: 0.32)], startPoint: .topLeading, endPoint: .bottomTrailing)
            Circle().fill(Color.f360Primary.opacity(0.75)).frame(width: 170, height: 170).blur(radius: 40).offset(x: 70, y: -60)
            Circle().fill(Color.f360Cyan.opacity(0.25)).frame(width: 120, height: 120).blur(radius: 40).offset(x: -70, y: 70)
        }
    }
}

// MARK: - Vistas

struct VistaPequena: View {
    let r: Resumen
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text("Saldo").font(.system(size: 12, weight: .semibold)).foregroundStyle(.white.opacity(0.72))
                Spacer()
                Image(systemName: "plus.circle.fill").font(.system(size: 20)).foregroundStyle(.white)
            }
            Spacer(minLength: 0)
            Text(r.sinDatos ? "—" : cop(r.saldo))
                .font(.system(size: 26, weight: .bold, design: .rounded))
                .foregroundStyle(r.saldo < 0 ? Color.f360Expense : .white)
                .minimumScaleFactor(0.5).lineLimit(1)
                .privacySensitive()
            Text(r.sinDatos ? "Abre la app" : "Hoy \(cop(-r.gastoHoy))")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(r.gastoHoy > 0 ? Color.f360Expense : .white.opacity(0.72))
                .lineLimit(1).minimumScaleFactor(0.7)
                .privacySensitive()
        }
        .widgetURL(urlGasto)
    }
}

struct VistaMediana: View {
    let r: Resumen
    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Saldo disponible").font(.system(size: 12, weight: .semibold)).foregroundStyle(.white.opacity(0.72))
                Text(r.sinDatos ? "—" : cop(r.saldo))
                    .font(.system(size: 28, weight: .bold, design: .rounded))
                    .foregroundStyle(r.saldo < 0 ? Color.f360Expense : .white)
                    .minimumScaleFactor(0.5).lineLimit(1)
                    .privacySensitive()
                Spacer(minLength: 0)
                VStack(alignment: .leading, spacing: 3) {
                    Text("Este mes \(copCorto(-r.gastoMes))")
                        .font(.system(size: 11, weight: .semibold)).foregroundStyle(.white.opacity(0.72))
                        .privacySensitive()
                    if !r.proximoPago.isEmpty {
                        Label(r.proximoPago, systemImage: "calendar")
                            .font(.system(size: 11, weight: .semibold)).foregroundStyle(.white.opacity(0.72))
                            .lineLimit(1).minimumScaleFactor(0.8)
                    }
                }
            }
            VStack(alignment: .trailing, spacing: 8) {
                VStack(alignment: .trailing, spacing: 2) {
                    Text("HOY").font(.system(size: 10, weight: .heavy)).tracking(0.8).foregroundStyle(.white.opacity(0.6))
                    Text(cop(-r.gastoHoy)).font(.system(size: 15, weight: .bold, design: .rounded))
                        .foregroundStyle(r.gastoHoy > 0 ? Color.f360Expense : .white)
                        .lineLimit(1).minimumScaleFactor(0.6)
                        .privacySensitive()
                }
                Spacer(minLength: 0)
                Link(destination: urlGasto) {
                    Label("Gasto", systemImage: "plus")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 14).padding(.vertical, 9)
                        .background(Color.f360Primary, in: Capsule())
                }
            }
            .frame(maxWidth: 120)
        }
        .widgetURL(urlInicio)
    }
}

struct VistaRectangular: View {
    let r: Resumen
    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text("Finanzas 360").font(.system(size: 12, weight: .semibold)).widgetAccentable()
            Text(r.sinDatos ? "—" : cop(r.saldo)).font(.system(size: 17, weight: .bold, design: .rounded)).minimumScaleFactor(0.6).privacySensitive()
            Text("Hoy \(cop(-r.gastoHoy))").font(.system(size: 12)).privacySensitive()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .widgetURL(urlGasto)
    }
}

struct VistaWidget: View {
    @Environment(\.widgetFamily) var familia
    let entrada: Entrada

    var body: some View {
        switch familia {
        case .accessoryRectangular:
            VistaRectangular(r: entrada.resumen).containerBackground(.clear, for: .widget)
        case .accessoryInline:
            Text("Hoy \(cop(-entrada.resumen.gastoHoy))").privacySensitive().containerBackground(.clear, for: .widget)
        case .systemMedium:
            VistaMediana(r: entrada.resumen).containerBackground(for: .widget) { FondoHero() }
        default:
            VistaPequena(r: entrada.resumen).containerBackground(for: .widget) { FondoHero() }
        }
    }
}

@main
struct FinanzasWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "FinanzasWidget", provider: Proveedor()) { entrada in
            VistaWidget(entrada: entrada)
        }
        .configurationDisplayName("Finanzas 360")
        .description("Tu saldo, lo que llevas gastado hoy y un atajo para registrar un gasto.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryInline])
    }
}
