// =============================================================================
//  IsometricRoom — 區域立體圖（等角 / isometric 2.5D 檢視）
//  以 react-three-fiber + three 渲染；OrthographicCamera 達成等角（非透視）。
//  幾何一律來自 roomGeometry（單一事實來源），人員座標沿用 2D 的座標系。
//  ⚠️ 無攝影機影像：房間幾何來自設定資料，人員位置來自 CSI 定位座標。
// =============================================================================
import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Bounds, RoundedBox, Html } from '@react-three/drei';
import type { Group } from 'three';
import type { RoomGeometry, Vec2m } from '../lib/roomGeometry';

const DEG = Math.PI / 180;
const WALL_T = 0.08; // 牆厚（公尺）

/** 受測者平面座標（公尺，與 2D 平面圖同座標系）。 */
export interface PersonPoint {
  x: number;
  y: number;
}

interface IsometricRoomProps {
  geometry: RoomGeometry;
  /** 受測者即時座標；null/未提供＝無定位（不畫綠點）。 */
  person?: PersonPoint | null;
}

// 房間座標（左上原點，x→右、y→下）→ three 世界座標（房間中心置於原點，Y 為上）
function planeToWorld(g: RoomGeometry, p: Vec2m): [number, number] {
  return [p.x - g.width_m / 2, p.y - g.height_m / 2];
}

// 受測者標記：每幀指數平滑趨近目標座標，讓 10Hz 的定位更新滑順、不瞬移
function PersonMarker({ geometry: g, person }: { geometry: RoomGeometry; person: PersonPoint }) {
  const ref = useRef<Group>(null);
  const inited = useRef(false);
  const [tx, tz] = planeToWorld(g, person);

  useFrame((_, dt) => {
    const grp = ref.current;
    if (!grp) return;
    if (!inited.current) {
      grp.position.set(tx, 0, tz); // 首幀直接定位，避免從原點滑進來
      inited.current = true;
      return;
    }
    const k = 1 - Math.pow(0.0015, Math.min(dt, 0.1)); // 約 1 秒收斂
    grp.position.x += (tx - grp.position.x) * k;
    grp.position.z += (tz - grp.position.z) * k;
  });

  return (
    <group ref={ref}>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.18, 0.28, 32]} />
        <meshBasicMaterial color="#34C759" transparent opacity={0.5} />
      </mesh>
      <mesh position={[0, 0.45, 0]}>
        <capsuleGeometry args={[0.16, 0.5, 4, 12]} />
        <meshStandardMaterial color="#34C759" />
      </mesh>
      <Html position={[0, 1.1, 0]} center>
        <span className="text-[8px] font-mono font-bold text-[#34C759] bg-white/80 px-1 rounded select-none whitespace-nowrap">
          ({person.x.toFixed(1)}, {person.y.toFixed(1)})
        </span>
      </Html>
    </group>
  );
}

function RoomScene({ geometry: g, person }: IsometricRoomProps) {
  const W = g.width_m;
  const H = g.height_m;
  const wh = g.wallHeight_m;

  return (
    <group>
      {/* 地板 */}
      <mesh rotation-x={-Math.PI / 2}>
        <planeGeometry args={[W, H]} />
        <meshStandardMaterial color="#eef2f7" />
      </mesh>

      {/* 遠側兩面外牆（全高，朝鏡頭背面，不擋內部） */}
      <mesh position={[0, wh / 2, -H / 2]}>
        <boxGeometry args={[W, wh, WALL_T]} />
        <meshStandardMaterial color="#cbd5e1" transparent opacity={0.9} />
      </mesh>
      <mesh position={[-W / 2, wh / 2, 0]}>
        <boxGeometry args={[WALL_T, wh, H]} />
        <meshStandardMaterial color="#cbd5e1" transparent opacity={0.9} />
      </mesh>

      {/* 近側兩道矮邊框（標示房界，避免遮擋） */}
      <mesh position={[0, 0.075, H / 2]}>
        <boxGeometry args={[W, 0.15, WALL_T]} />
        <meshStandardMaterial color="#cbd5e1" />
      </mesh>
      <mesh position={[W / 2, 0.075, 0]}>
        <boxGeometry args={[WALL_T, 0.15, H]} />
        <meshStandardMaterial color="#cbd5e1" />
      </mesh>

      {/* 機能區域（浴室）：地板著色 + 可選矮牆隔間 */}
      {g.zones?.map((z) => {
        const cx = z.origin.x + z.size.w / 2;
        const cy = z.origin.y + z.size.d / 2;
        const [wx, wz] = planeToWorld(g, { x: cx, y: cy });
        const ph = z.partitionHeight_m ?? 0;
        return (
          <group key={z.id}>
            <mesh rotation-x={-Math.PI / 2} position={[wx, 0.01, wz]}>
              <planeGeometry args={[z.size.w, z.size.d]} />
              <meshStandardMaterial color="#dbeafe" transparent opacity={0.7} />
            </mesh>
            {ph > 0 && (
              <>
                <mesh position={[wx + z.size.w / 2, ph / 2, wz]}>
                  <boxGeometry args={[WALL_T, ph, z.size.d]} />
                  <meshStandardMaterial color="#bfdbfe" />
                </mesh>
                <mesh position={[wx, ph / 2, wz + z.size.d / 2]}>
                  <boxGeometry args={[z.size.w, ph, WALL_T]} />
                  <meshStandardMaterial color="#bfdbfe" />
                </mesh>
              </>
            )}
            {z.label && (
              <Html position={[wx, 0.05, wz]} center>
                <span className="text-[10px] font-medium text-slate-400 select-none">{z.label}</span>
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
              <meshStandardMaterial color="#e2e8f0" />
            </RoundedBox>
            {/* 床墊 */}
            <RoundedBox args={[b.size.w * 0.9, 0.12, b.size.d * 0.92]} radius={0.04} position={[0, bedH + 0.06, 0]}>
              <meshStandardMaterial color="#f8fafc" />
            </RoundedBox>
            {/* 枕頭（床頭端） */}
            <RoundedBox args={[b.size.w * 0.7, 0.12, b.size.d * 0.18]} radius={0.04} position={[0, bedH + 0.14, -b.size.d * 0.34]}>
              <meshStandardMaterial color="#cbd5e1" />
            </RoundedBox>
            {b.label && (
              <Html position={[0, bedH + 0.45, 0]} center>
                <span className="text-[10px] font-medium text-slate-400 select-none">{b.label}</span>
              </Html>
            )}
          </group>
        );
      })}

      {/* CSI 感測器：細桿 + 藍色菱形 + 標籤 */}
      {g.sensors.map((s) => {
        const [wx, wz] = planeToWorld(g, s.center);
        const h = s.height_m ?? 1.8;
        return (
          <group key={s.id} position={[wx, 0, wz]}>
            <mesh position={[0, h / 2, 0]}>
              <cylinderGeometry args={[0.015, 0.015, h, 8]} />
              <meshStandardMaterial color="#94a3b8" />
            </mesh>
            <mesh position={[0, h, 0]} rotation={[0, Math.PI / 4, 0]}>
              <octahedronGeometry args={[0.12]} />
              <meshStandardMaterial color="#007AFF" />
            </mesh>
            {s.label && (
              <Html position={[0, h + 0.28, 0]} center>
                <span className="text-[8px] font-bold uppercase tracking-tight text-[#007AFF] select-none">{s.label}</span>
              </Html>
            )}
          </group>
        );
      })}

      {/* 受測者位置（綠色），座標沿用 2D 同一條 CSI 定位資料；無定位則不畫 */}
      {person && <PersonMarker geometry={g} person={person} />}
    </group>
  );
}

export function IsometricRoom({ geometry, person }: IsometricRoomProps) {
  const reach = Math.max(geometry.width_m, geometry.height_m);
  return (
    <Canvas
      orthographic
      camera={{ position: [reach, reach, reach], zoom: 50, near: 0.1, far: 100 }}
      gl={{ antialias: true }}
      dpr={[1, 2]}
    >
      <color attach="background" args={['#ffffff']} />
      <ambientLight intensity={0.85} />
      <directionalLight position={[6, 12, 8]} intensity={0.55} />
      <directionalLight position={[-6, 8, -8]} intensity={0.25} />
      {/* Bounds：自動把等角鏡頭縮放到剛好框住房間（保留鏡頭方向＝等角） */}
      <Bounds fit clip observe margin={1.15}>
        <RoomScene geometry={geometry} person={person} />
      </Bounds>
    </Canvas>
  );
}
