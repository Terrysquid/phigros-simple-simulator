import SwiftUI

struct ContentView: View {
    @State private var isPaused = false
    var body: some View {
        GeometryReader { geo in
            let h = geo.size.height
            let w = min(geo.size.width, (16.0 / 9.0) * h)
            ZStack {
                Color.black.ignoresSafeArea()
                ZStack {
                    Rectangle()
                        .fill(Color.white)
                        .frame(
                            width: (144.0 / 25.0) * h,
                            height: h / 160.0
                        )
                        .position(x: w / 2.0, y: h / 2.0)
                }
                .frame(width: w, height: h)
                .position(x: geo.size.width / 2.0, y: geo.size.height / 2.0)
                .allowsHitTesting(!isPaused)
                if isPaused {
                    Rectangle()
                        .fill(Color.black.opacity(0.35))
                        .frame(width: w, height: h)
                        .position(x: geo.size.width / 2.0, y: geo.size.height / 2.0)
                }

                VStack {
                    HStack {
                        Button(isPaused ? "Resume" : "Stop") {
                            isPaused.toggle()
                        }
                        .padding(10)
                        .background(Color.black.opacity(0.6))
                        .foregroundColor(.white)
                        .cornerRadius(8)

                        Spacer()
                    }
                    .padding(.leading, 12)
                    .padding(.top, 12)

                    Spacer()
                }
            }
        }
    }
}