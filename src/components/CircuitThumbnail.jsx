import React from 'react';

export default function CircuitThumbnail({ caseId, isSelected }) {
  // SVG circuit schematic rendering based on case ID density
  const getNodes = () => {
    switch (caseId) {
      case 'case9':
        return [
          { x: 30, y: 30 }, { x: 100, y: 20 }, { x: 170, y: 30 },
          { x: 40, y: 65 }, { x: 100, y: 65 }, { x: 160, y: 65 },
          { x: 20, y: 95 }, { x: 100, y: 100 }, { x: 180, y: 95 }
        ];
      case 'case14':
        return [
          { x: 30, y: 30 }, { x: 90, y: 25 }, { x: 150, y: 35 }, { x: 190, y: 70 },
          { x: 40, y: 60 }, { x: 100, y: 55 }, { x: 140, y: 65 }, { x: 70, y: 95 },
          { x: 120, y: 90 }, { x: 160, y: 95 }, { x: 20, y: 85 }, { x: 175, y: 25 },
          { x: 110, y: 115 }, { x: 50, y: 115 }
        ];
      case 'case30':
      case 'case39':
      default:
        // Generate neat grid pattern for larger networks
        const nodes = [];
        const count = caseId === 'case30' ? 24 : caseId === 'case118' ? 36 : 28;
        for (let i = 0; i < count; i++) {
          const row = Math.floor(i / 6);
          const col = i % 6;
          const jitterX = Math.sin(i * 1.5) * 8;
          const jitterY = Math.cos(i * 1.8) * 6;
          nodes.push({
            x: 25 + col * 28 + jitterX,
            y: 20 + row * 22 + jitterY
          });
        }
        return nodes;
    }
  };

  const nodes = getNodes();

  // Create connections between adjacent nodes
  const links = [];
  for (let i = 0; i < nodes.length; i++) {
    const targetIdx = (i + 1) % nodes.length;
    links.push({ source: nodes[i], target: nodes[targetIdx] });
    if (i + 3 < nodes.length) {
      links.push({ source: nodes[i], target: nodes[i + 3] });
    }
  }

  const strokeColor = isSelected ? '#55d8e1' : '#00adb5';
  const nodeFill = isSelected ? '#55d8e1' : '#869394';

  return (
    <div className={`h-24 w-full md:w-56 rounded-lg relative overflow-hidden transition-all duration-300 border ${
      isSelected ? 'border-[#55d8e1]/40 shadow-[0_0_15px_rgba(85,216,225,0.15)] bg-[#131316]' : 'border-[#2D333B] bg-[#131316]'
    }`}>
      {/* Background grid */}
      <div className="absolute inset-0 bg-[radial-gradient(#2D333B_1px,transparent_1px)] [background-size:12px_12px] opacity-60" />

      {/* Circuit lines */}
      <svg className="w-full h-full relative z-10" viewBox="0 0 200 130">
        {links.map((link, idx) => (
          <line
            key={idx}
            x1={link.source.x}
            y1={link.source.y}
            x2={link.target.x}
            y2={link.target.y}
            stroke={strokeColor}
            strokeWidth={isSelected ? "1.5" : "1"}
            strokeOpacity={isSelected ? "0.7" : "0.35"}
          />
        ))}

        {nodes.map((node, idx) => (
          <g key={idx}>
            <circle
              cx={node.x}
              cy={node.y}
              r={idx % 4 === 0 ? "3" : "2"}
              fill={idx % 5 === 0 ? (isSelected ? "#FFD369" : "#bd9733") : nodeFill}
              opacity={isSelected ? "0.9" : "0.6"}
            />
            {isSelected && idx % 3 === 0 && (
              <circle
                cx={node.x}
                cy={node.y}
                r="5"
                fill="none"
                stroke="#55d8e1"
                strokeWidth="0.8"
                className="animate-ping opacity-40"
              />
            )}
          </g>
        ))}
      </svg>

      {/* Gradient Overlay */}
      <div className={`absolute inset-0 pointer-events-none ${
        isSelected ? 'bg-gradient-to-t from-[#55d8e1]/10 via-transparent to-transparent' : 'bg-gradient-to-t from-[#131316]/60 via-transparent to-transparent'
      }`} />

      {isSelected && (
        <div className="absolute bottom-2 right-2 flex gap-1 z-20">
          <div className="w-1.5 h-3.5 bg-[#55d8e1] animate-pulse rounded-full" />
          <div className="w-1.5 h-3.5 bg-[#55d8e1]/50 rounded-full" />
          <div className="w-1.5 h-3.5 bg-[#55d8e1]/20 rounded-full" />
        </div>
      )}
    </div>
  );
}
