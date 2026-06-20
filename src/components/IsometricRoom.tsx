// =============================================================================
//  IsometricRoom — 區域立體圖（等角 / isometric 2.5D 檢視）
//  react-three-fiber + three；OrthographicCamera 達成等角（非透視）。
//  幾何一律來自 roomGeometry（單一事實來源），人員座標沿用 2D 的座標系。
//  ⚠️ 無攝影機影像：房間幾何來自設定資料，人員位置來自 CSI 定位座標。
//
//  兩種模式：
//   • 一般（面板用）：輕量、白底、靜態等角。
//   • cinematic（全螢幕用）：醫療深藍科技風 —— 反射地板 + 網格 + 玻璃牆 +
//     發光標記(bloom) + 雷達脈衝 + 粒子，可旋轉鏡頭。
// =============================================================================
import { memo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import {
  Bounds, RoundedBox, Html, Grid, Sparkles, ContactShadows,
  MeshReflectorMaterial, Edges, OrbitControls,
} from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { MOUSE } from 'three';
import type { Group, Mesh, MeshBasicMaterial } from 'three';
import type { RoomGeometry, Vec2m, SensorGeometry, AnchorGeometry } from '../lib/roomGeometry';

const DEG = Math.PI / 180;
const WALL_T = 0.08;

// 深藍科技風配色
const CYAN = '#22d3ee';   // CSI 感測器
const GREEN = '#34d399';  // 受測者
const RED = '#FF3B30';    // 跌倒警報
const AP_COLOR = '#a78bfa'; // Wi-Fi 定位 AP（紫，與青色 CSI 區分）

/** 受測者平面座標（公尺，與 2D 平面圖同座標系）。 */
export interface PersonPoint {
  x: number;
  y: number;
}

interface IsometricRoomProps {
  geometry: RoomGeometry;
  /** 受測者即時座標；null/未提供＝無定位（不畫綠點）。 */
  person?: PersonPoint | null;
  /** 跌倒警報：受測者標記轉紅 + 光柱/衝擊波/紅光。 */
  alert?: boolean;
  /** 可旋轉/縮放鏡頭（全螢幕用）。 */
  interactive?: boolean;
  /** 醫療深藍科技風（發光/反射/粒子）。 */
  cinematic?: boolean;
}

// 房間座標（左上原點，x→右、y→下）→ three 世界座標（房間中心置於原點，Y 為上）
function planeToWorld(g: RoomGeometry, p: Vec2m): [number, number] {
  return [p.x - g.width_m / 2, p.y - g.height_m / 2];
}

// 擴張淡出的環（雷達/脈衝效果）；delay 可做相位錯開，疊出連續衝擊波
function PulseRing({ color, period, max, inner = 0.9, outer = 1.0, delay = 0, opacity = 0.55 }: {
  color: string; period: number; max: number; inner?: number; outer?: number; delay?: number; opacity?: number;
}) {
  const ref = useRef<Mesh>(null);
  useFrame((state) => {
    const m = ref.current;
    if (!m) return;
    const t = ((((state.clock.elapsedTime + delay) % period) + period) % period) / period; // 0..1
    const s = 0.12 + t * max;
    m.scale.set(s, s, s);
    (m.material as MeshBasicMaterial).opacity = (1 - t) * opacity;
  });
  return (
    <mesh ref={ref} rotation-x={-Math.PI / 2} position={[0, 0.03, 0]}>
      <ringGeometry args={[inner, outer, 64]} />
      <meshBasicMaterial color={color} transparent opacity={0.5} toneMapped={false} />
    </mesh>
  );
}

// 受測者標記：每幀指數平滑趨近目標，10Hz 定位滑順不瞬移。
// alert＝跌倒警報：轉紅 + 球體彈跳脈動 + 紅色光柱 + 跟隨點光源 + 地面衝擊波，吸睛。
function PersonMarker({ geometry: g, person, cinematic, alert = false }: {
  geometry: RoomGeometry; person: PersonPoint; cinematic: boolean; alert?: boolean;
}) {
  const ref = useRef<Group>(null);
  const sphereRef = useRef<Mesh>(null);
  const inited = useRef(false);
  const [tx, tz] = planeToWorld(g, person);
  const color = alert ? RED : GREEN;

  useFrame((state, dt) => {
    const grp = ref.current;
    if (grp) {
      if (!inited.current) {
        grp.position.set(tx, 0, tz);
        inited.current = true;
      } else {
        const k = 1 - Math.pow(0.0015, Math.min(dt, 0.1)); // 約 1 秒收斂
        grp.position.x += (tx - grp.position.x) * k;
        grp.position.z += (tz - grp.position.z) * k;
      }
    }
    // 跌倒時球體快速脈動（放大縮小），製造急促警示感
    if (sphereRef.current) {
      sphereRef.current.scale.setScalar(alert ? 1 + Math.sin(state.clock.elapsedTime * 9) * 0.2 : 1);
    }
  });

  return (
    <group ref={ref}>
      {/* 地面衝擊波：跌倒＝紅色連續快波（兩道相位錯開）；平時＝cinematic 綠色慢波 */}
      {alert ? (
        <>
          <PulseRing color={RED} period={1.0} max={2.4} inner={0.16} outer={0.30} opacity={0.7} />
          <PulseRing color={RED} period={1.0} max={2.4} inner={0.16} outer={0.30} opacity={0.7} delay={0.5} />
        </>
      ) : cinematic ? (
        <PulseRing color={GREEN} period={1.6} max={1.0} inner={0.26} outer={0.32} />
      ) : null}

      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.16, 0.24, 40]} />
        <meshBasicMaterial color={color} transparent opacity={cinematic || alert ? 0.85 : 0.5} toneMapped={false} />
      </mesh>
      {/* 位置標記：懸浮發光球體（落在地面光環上），不是柱子 */}
      <mesh ref={sphereRef} position={[0, 0.42, 0]}>
        <sphereGeometry args={[0.19, 24, 24]} />
        {alert
          ? <meshStandardMaterial color={RED} emissive={RED} emissiveIntensity={2.4} toneMapped={false} roughness={0.35} />
          : cinematic
            ? <meshStandardMaterial color={GREEN} emissive={GREEN} emissiveIntensity={1.25} toneMapped={false} roughness={0.4} />
            : <meshStandardMaterial color="#34C759" />}
      </mesh>
      {/* 跌倒：沖天紅色光柱 + 跟隨紅光點光源（打亮整個房間，全螢幕 cinematic 配 bloom 更炸） */}
      {alert && (
        <>
          <mesh position={[0, 1.7, 0]}>
            <cylinderGeometry args={[0.08, 0.08, 3.4, 18, 1, true]} />
            <meshBasicMaterial color={RED} transparent opacity={0.3} toneMapped={false} side={2} />
          </mesh>
          <pointLight position={[0, 1.2, 0]} intensity={cinematic ? 10 : 4} distance={8} color={RED} />
        </>
      )}
      {/* 飄字只在輕量面板模式用 DOM；cinematic 改由 modal 的 HUD 顯示，避免每幀重排造成卡頓 */}
      {!cinematic && (
        <Html position={[0, 1.15, 0]} center>
          {alert ? (
            <span className="text-[9px] font-bold text-white bg-[#FF3B30] px-1.5 py-0.5 rounded shadow-lg select-none whitespace-nowrap animate-pulse">
              ⚠ 跌倒警報
            </span>
          ) : (
            <span className="text-[8px] font-mono font-bold text-[#34C759] bg-white/80 px-1 rounded select-none whitespace-nowrap">
              ({person.x.toFixed(1)}, {person.y.toFixed(1)})
            </span>
          )}
        </Html>
      )}
    </group>
  );
}

// CSI 感測器（ESP32，移動/跌倒偵測）：貼牆安裝；cinematic 時發光 + 偵測脈衝
function SensorMarker({ geometry: g, sensor, cinematic }: {
  geometry: RoomGeometry; sensor: SensorGeometry; cinematic: boolean;
}) {
  const [wx, wz] = planeToWorld(g, sensor.center);
  const h = sensor.height_m ?? 1.8;
  const wall = sensor.mountWall;
  const inward = 0.05;
  // 掛牆位置：把外殼貼到牆面、發光面朝室內；並把整個裝置轉到「面向室內」
  let px = wx, pz = wz;
  let rotY = 0;
  if (wall === 'yMin') { pz = wz + inward; rotY = 0; }
  else if (wall === 'yMax') { pz = wz - inward; rotY = Math.PI; }
  else if (wall === 'xMin') { px = wx + inward; rotY = Math.PI / 2; }
  else if (wall === 'xMax') { px = wx - inward; rotY = -Math.PI / 2; }

  return (
    <group>
      {wall ? (
        // 本地 +z = 室內方向（已用 rotY 對齊牆面）
        <group position={[px, h, pz]} rotation={[0, rotY, 0]}>
          {/* 貼牆安裝底座 */}
          <RoundedBox args={[0.42, 0.3, 0.07]} radius={0.03} position={[0, 0, -0.02]}>
            <meshStandardMaterial color={cinematic ? '#13354a' : '#cbd5e1'} metalness={0.5} roughness={0.35} />
            {cinematic && <Edges threshold={15} color={CYAN} />}
          </RoundedBox>
          {/* 發光感測面（朝室內） */}
          <mesh position={[0, 0, 0.06]}>
            <sphereGeometry args={[0.1, 20, 20]} />
            {cinematic
              ? <meshStandardMaterial color={CYAN} emissive={CYAN} emissiveIntensity={2.8} toneMapped={false} />
              : <meshStandardMaterial color="#007AFF" />}
          </mesh>
          {/* 偵測範圍光錐：頂點在牆面感測器、開口朝室內，明確表示「貼牆朝內掃描」 */}
          {cinematic && (
            <mesh position={[0, 0, 0.75]} rotation={[-Math.PI / 2, 0, 0]}>
              <coneGeometry args={[0.55, 1.5, 32, 1, true]} />
              <meshBasicMaterial color={CYAN} transparent opacity={0.06} toneMapped={false} side={2} />
            </mesh>
          )}
        </group>
      ) : (
        <group position={[wx, 0, wz]}>
          <mesh position={[0, h / 2, 0]}>
            <cylinderGeometry args={[0.015, 0.015, h, 8]} />
            <meshStandardMaterial color={cinematic ? '#475569' : '#94a3b8'} />
          </mesh>
          <mesh position={[0, h, 0]} rotation={[0, Math.PI / 4, 0]}>
            <octahedronGeometry args={[0.13]} />
            {cinematic
              ? <meshStandardMaterial color={CYAN} emissive={CYAN} emissiveIntensity={2} toneMapped={false} />
              : <meshStandardMaterial color="#007AFF" />}
          </mesh>
        </group>
      )}
      {/* 偵測脈衝（地面投影） */}
      {cinematic && (
        <group position={[wx, 0, wz]}>
          <PulseRing color={CYAN} period={2.4} max={1.6} />
        </group>
      )}
      {sensor.label && !cinematic && (
        <Html position={[wx, h + 0.25, wz]} center>
          <span className="text-[8px] font-bold uppercase tracking-tight text-[#007AFF] select-none">
            {sensor.label}
          </span>
        </Html>
      )}
    </group>
  );
}

// Wi-Fi 定位 AP（錨點）：對應 KNOWN_APS；至少 3 個才能三角定位
function AnchorMarker({ geometry: g, anchor, cinematic }: {
  geometry: RoomGeometry; anchor: AnchorGeometry; cinematic: boolean;
}) {
  const [wx, wz] = planeToWorld(g, anchor.position);
  const h = anchor.height_m ?? 2.4;
  return (
    <group position={[wx, 0, wz]}>
      <mesh position={[0, h, 0]}>
        <boxGeometry args={[0.18, 0.1, 0.18]} />
        {cinematic
          ? <meshStandardMaterial color={AP_COLOR} emissive={AP_COLOR} emissiveIntensity={1.5} toneMapped={false} />
          : <meshStandardMaterial color="#7c3aed" />}
      </mesh>
      {/* 天線 */}
      <mesh position={[0, h + 0.14, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.22, 6]} />
        <meshStandardMaterial color={AP_COLOR} emissive={AP_COLOR} emissiveIntensity={cinematic ? 1.2 : 0} toneMapped={false} />
      </mesh>
      {anchor.ssid && !cinematic && (
        <Html position={[0, h + 0.4, 0]} center>
          <span className="text-[8px] font-bold tracking-tight text-purple-600 select-none">{anchor.ssid}</span>
        </Html>
      )}
    </group>
  );
}

// 三角定位距離圈：每個 AP 一圈，半徑＝AP 到受測者距離；三圈交於受測者
function TrilaterationRings({ geometry: g, person }: { geometry: RoomGeometry; person: PersonPoint }) {
  if (!g.anchors) return null;
  return (
    <>
      {g.anchors.map((a) => {
        const d = Math.hypot(person.x - a.position.x, person.y - a.position.y);
        const [wx, wz] = planeToWorld(g, a.position);
        return (
          <mesh key={a.id} rotation-x={-Math.PI / 2} position={[wx, 0.014, wz]}>
            <ringGeometry args={[Math.max(0.001, d - 0.025), d, 96]} />
            <meshBasicMaterial color={CYAN} transparent opacity={0.3} toneMapped={false} side={2} />
          </mesh>
        );
      })}
    </>
  );
}

function Wall({ args, position, cinematic }: {
  args: [number, number, number]; position: [number, number, number]; cinematic: boolean;
}) {
  return (
    <mesh position={position}>
      <boxGeometry args={args} />
      {cinematic
        ? <meshStandardMaterial color="#0e2038" transparent opacity={0.22} metalness={0.5} roughness={0.25} />
        : <meshStandardMaterial color="#cbd5e1" transparent opacity={0.9} />}
      {cinematic && <Edges threshold={15} color={CYAN} />}
    </mesh>
  );
}

// 只含「靜態」物件 —— 會動的受測者/三角定位圈放在 Bounds 之外（見 IsometricRoom）
function RoomScene({ geometry: g, cinematic }: {
  geometry: RoomGeometry; cinematic: boolean;
}) {
  const W = g.width_m;
  const H = g.height_m;
  const wh = g.wallHeight_m;

  return (
    <group>
      {/* 地板 */}
      {cinematic ? (
        <mesh rotation-x={-Math.PI / 2}>
          <planeGeometry args={[W * 2.2, H * 2.2]} />
          <MeshReflectorMaterial
            blur={[160, 50]} resolution={512} mixBlur={1.2} mixStrength={26}
            roughness={0.9} depthScale={1} minDepthThreshold={0.4} maxDepthThreshold={1.4}
            color="#0a1628" metalness={0.6}
          />
        </mesh>
      ) : (
        <mesh rotation-x={-Math.PI / 2}>
          <planeGeometry args={[W, H]} />
          <meshStandardMaterial color="#eef2f7" />
        </mesh>
      )}
      {cinematic && (
        <Grid
          args={[W * 2.2, H * 2.2]} position={[0, 0.006, 0]}
          cellSize={0.5} cellColor="#16324e" sectionSize={2} sectionColor="#1f6f8b"
          fadeDistance={20} fadeStrength={1.5} infiniteGrid={false}
        />
      )}

      {/* 遠側兩面外牆（全高） */}
      <Wall args={[W, wh, WALL_T]} position={[0, wh / 2, -H / 2]} cinematic={cinematic} />
      <Wall args={[WALL_T, wh, H]} position={[-W / 2, wh / 2, 0]} cinematic={cinematic} />
      {/* 近側兩道矮邊框 */}
      <Wall args={[W, 0.15, WALL_T]} position={[0, 0.075, H / 2]} cinematic={cinematic} />
      <Wall args={[WALL_T, 0.15, H]} position={[W / 2, 0.075, 0]} cinematic={cinematic} />

      {/* 機能區域（浴室） */}
      {g.zones?.map((z) => {
        const cx = z.origin.x + z.size.w / 2;
        const cy = z.origin.y + z.size.d / 2;
        const [wx, wz] = planeToWorld(g, { x: cx, y: cy });
        const ph = z.partitionHeight_m ?? 0;
        return (
          <group key={z.id}>
            <mesh rotation-x={-Math.PI / 2} position={[wx, 0.012, wz]}>
              <planeGeometry args={[z.size.w, z.size.d]} />
              <meshStandardMaterial
                color={cinematic ? '#0e3a4a' : '#dbeafe'}
                emissive={cinematic ? '#0e3a4a' : '#000000'} emissiveIntensity={cinematic ? 0.4 : 0}
                transparent opacity={cinematic ? 0.55 : 0.7}
              />
            </mesh>
            {ph > 0 && (
              <>
                <Wall args={[WALL_T, ph, z.size.d]} position={[wx + z.size.w / 2, ph / 2, wz]} cinematic={cinematic} />
                <Wall args={[z.size.w, ph, WALL_T]} position={[wx, ph / 2, wz + z.size.d / 2]} cinematic={cinematic} />
              </>
            )}
            {z.label && !cinematic && (
              <Html position={[wx, 0.05, wz]} center>
                <span className="text-[10px] font-medium text-slate-400 select-none">
                  {z.label}
                </span>
              </Html>
            )}
          </group>
        );
      })}

      {/* 病床（可多張） */}
      {g.beds.map((b) => {
        const [wx, wz] = planeToWorld(g, b.center);
        const bedH = 0.5;
        return (
          <group key={b.id} position={[wx, 0, wz]} rotation-y={-(b.rotationDeg ?? 0) * DEG}>
            <RoundedBox args={[b.size.w, bedH, b.size.d]} radius={0.06} smoothness={3} position={[0, bedH / 2, 0]}>
              <meshStandardMaterial color={cinematic ? '#16263d' : '#e2e8f0'} metalness={cinematic ? 0.3 : 0} roughness={cinematic ? 0.5 : 1} />
              {cinematic && <Edges threshold={15} color="#2b5e7a" />}
            </RoundedBox>
            <RoundedBox args={[b.size.w * 0.9, 0.12, b.size.d * 0.92]} radius={0.04} position={[0, bedH + 0.06, 0]}>
              <meshStandardMaterial color={cinematic ? '#22405f' : '#f8fafc'} />
            </RoundedBox>
            <RoundedBox args={[b.size.w * 0.7, 0.12, b.size.d * 0.18]} radius={0.04} position={[0, bedH + 0.14, -b.size.d * 0.34]}>
              <meshStandardMaterial color={cinematic ? '#2e5675' : '#cbd5e1'} />
            </RoundedBox>
            {b.label && !cinematic && (
              <Html position={[0, bedH + 0.45, 0]} center>
                <span className="text-[10px] font-medium text-slate-400 select-none">
                  {b.label}
                </span>
              </Html>
            )}
          </group>
        );
      })}

      {/* CSI 感測器（貼牆） */}
      {g.sensors.map((s) => (
        <SensorMarker key={s.id} geometry={g} sensor={s} cinematic={cinematic} />
      ))}

      {/* Wi-Fi 定位 AP（≥3，三角定位用） */}
      {g.anchors?.map((a) => (
        <AnchorMarker key={a.id} geometry={g} anchor={a} cinematic={cinematic} />
      ))}

      {cinematic && (
        <>
          <ContactShadows position={[0, 0.015, 0]} scale={Math.max(W, H) * 1.6} blur={2.4} opacity={0.45} far={4} color="#000814" />
          <Sparkles count={22} scale={[W, wh, H]} position={[0, wh / 2, 0]} size={2} speed={0.25} color={CYAN} opacity={0.45} />
        </>
      )}
    </group>
  );
}

export const IsometricRoom = memo(function IsometricRoom({ geometry, person, alert = false, interactive = false, cinematic = false }: IsometricRoomProps) {
  const reach = Math.max(geometry.width_m, geometry.height_m);
  return (
    <Canvas
      // 小面板：正交等角（示意圖）；全螢幕互動：透視相機（像一般 3D 檢視器，手感自然）
      orthographic={!interactive}
      camera={interactive
        ? { position: [reach * 1.6, reach * 1.3, reach * 1.6], fov: 38, near: 0.1, far: 200 }
        : { position: [reach, reach, reach], zoom: 50, near: 0.1, far: 100 }}
      gl={{ antialias: true }}
      dpr={[1, 2]}
    >
      <color attach="background" args={[cinematic ? '#081323' : '#ffffff']} />
      <ambientLight intensity={cinematic ? 0.55 : 0.85} />
      <directionalLight position={[6, 12, 8]} intensity={cinematic ? 0.7 : 0.55} color={cinematic ? '#bfefff' : '#ffffff'} />
      <directionalLight position={[-6, 8, -8]} intensity={cinematic ? 0.35 : 0.25} color={cinematic ? '#1f6f8b' : '#ffffff'} />
      {cinematic && <pointLight position={[0, 3, 0]} intensity={6} distance={12} color={CYAN} />}

      {/* Bounds 只框「靜態房間」。interactive 時不 observe → 開啟時框一次後，鏡頭完全交給
          OrbitControls（否則 observe 會在縮放時重新框景，導致中心亂跳、自動縮回）。 */}
      <Bounds fit clip observe={!interactive} margin={cinematic ? 1.1 : 1.15}>
        <RoomScene geometry={geometry} cinematic={cinematic} />
      </Bounds>

      {/* 會動的物件放在 Bounds 之外：移動時不再觸發重新框景（鏡頭不亂跳、不自動縮回） */}
      {cinematic && person && <TrilaterationRings geometry={geometry} person={person} />}
      {person && <PersonMarker geometry={geometry} person={person} cinematic={cinematic} alert={alert} />}

      {interactive && (
        <OrbitControls
          makeDefault
          enablePan zoomToCursor
          enableDamping dampingFactor={0.08}
          minDistance={2} maxDistance={40}
          maxPolarAngle={Math.PI / 2.05}
          // 左鍵環繞、中鍵平移（移動視角）、右鍵也平移；滾輪縮放
          mouseButtons={{ LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.PAN, RIGHT: MOUSE.PAN }}
        />
      )}

      {cinematic && (
        <EffectComposer>
          <Bloom mipmapBlur intensity={0.9} luminanceThreshold={0.55} luminanceSmoothing={0.3} />
        </EffectComposer>
      )}
    </Canvas>
  );
});
