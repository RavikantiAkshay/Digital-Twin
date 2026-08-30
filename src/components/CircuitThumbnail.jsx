import React from 'react';

export default function CircuitThumbnail({ caseId, isSelected }) {
  // SVG circuit schematic rendering tailored to the editorial light aesthetic
  const getNodes = () => {
    switch (caseId) {
      case 'case9':
        return [
          { x: 35, y: 35, isGen: true }, { x: 100, y: 22, isGen: true }, { x: 165, y: 35, isGen: true },
          { x: 45, y: 65 }, { x: 100, y: 65 }, { x: 155, y: 65 },
          { x: 30, y: 95 }, { x: 100, y: 100 }, { x: 170, y: 95 }
        ];
      case 'case14':
        return [
          { x: 30, y: 30, isGen: true }, { x: 90, y: 25, isGen: true }, { x: 150, y: 35, isGen: true }, { x: 175, y: 25, isGen: true },
          { x: 40, y: 60 }, { x: 100, y: 55 }, { x: 140, y: 65 }, { x: 185, y: 70 },
          { x: 70, y: 95 }, { x: 120, y: 90 }, { x: 160, y: 95, isGen: true }, { x: 20, y: 85 },
          { x: 110, y: 112 }, { x: 50, y: 112 }
        ];
      case 'case30':
        const nodes30 = [];
        for (let i = 0; i < 24; i++) {
          const row = Math.floor(i / 6);
          const col = i % 6;
          const jX = Math.sin(i * 1.7) * 7;
          const jY = Math.cos(i * 1.9) * 5;
          nodes30.push({
            x: 28 + col * 26 + jX,
            y: 22 + row * 24 + jY,
            isGen: i % 4 === 0
          });
        }
        return nodes30;
      case 'case39':
        const nodes39 = [];
        for (let i = 0; i < 28; i++) {
          const row = Math.floor(i / 7);
          const col = i % 7;
          const jX = Math.sin(i * 1.4) * 6;
          const jY = Math.cos(i * 1.6) * 5;
          nodes39.push({
            x: 24 + col * 24 + jX,
            y: 20 + row * 24 + jY,
            isGen: i % 3 === 0
          });
        }
        return nodes39;
      case 'case57':
      case 'case118':
      case 'case300':
        const nodesDense = [];
        const count = caseId === 'case57' ? 32 : 40;
        for (let i = 0; i < count; i++) {
          const row = Math.floor(i / 8);
          const col = i % 8;
          const jX = Math.sin(i * 1.8) * 6;
          const jY = Math.cos(i * 2.1) * 5;
          nodesDense.push({
            x: 20 + col * 21 + jX,
            y: 18 + row * 20 + jY,
            isGen: i % 5 === 0
          });
        }
        return nodesDense;
      case '3bus':
        return [
          { x: 50, y: 35, isGen: true },
          { x: 150, y: 35, isGen: true },
          { x: 100, y: 98, isGen: false }
        ];
      case '5bus':
        return [
          { x: 40, y: 35, isGen: true },
          { x: 160, y: 35, isGen: true },
          { x: 100, y: 65, isGen: false },
          { x: 45, y: 98, isGen: false },
          { x: 155, y: 98, isGen: false }
        ];
      case 'blank':
        return [
          { x: 60, y: 65, isGen: true },
          { x: 140, y: 65, isGen: false }
        ];
      default:
        return [
          { x: 40, y: 40, isGen: true },
          { x: 160, y: 40, isGen: true },
          { x: 100, y: 95, isGen: false }
        ];
    }
  };

  const nodes = getNodes();

  // Create schematic connection lines
  const links = [];
  for (let i = 0; i < nodes.length; i++) {
    const targetIdx = (i + 1) % nodes.length;
    links.push({ source: nodes[i], target: nodes[targetIdx] });
    if (i + 3 < nodes.length) {
      links.push({ source: nodes[i], target: nodes[i + 3] });
    }
    if (i + 5 < nodes.length && i % 2 === 0) {
      links.push({ source: nodes[i], target: nodes[i + 5] });
    }
  }

  // Refined palette matching reference image:
  // Selected: sage/teal `#2E4F4A` lines and `#1E3834` nodes
  // Default: subtle warm graphite `#605E57` lines and `#3A3833` nodes
  const strokeColor = isSelected ? '#2E504A' : '#737067';
  const nodeFill = isSelected ? '#1E3834' : '#45433E';
  const genFill = isSelected ? '#C08A2E' : '#A67C33';

  return (
    <div className={`h-28 w-full rounded-md relative overflow-hidden transition-all duration-300 border flex items-center justify-center ${
      isSelected 
        ? 'border-[#8DA89E] bg-[#DFE7E2]' 
        : 'border-[#DDD8CD] bg-[#EAE6DC]'
    }`}>
      {/* Background subtle grid pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(#CCC7BA_1px,transparent_1px)] [background-size:12px_12px] opacity-40" />

      {/* Circuit lines */}
      <svg className="w-full h-full relative z-10 px-2 py-1" viewBox="0 0 200 130" preserveAspectRatio="xMidYMid meet">
        {links.map((link, idx) => (
          <line
            key={idx}
            x1={link.source.x}
            y1={link.source.y}
            x2={link.target.x}
            y2={link.target.y}
            stroke={strokeColor}
            strokeWidth={isSelected ? "1.4" : "1.0"}
            strokeOpacity={isSelected ? "0.65" : "0.38"}
          />
        ))}

        {nodes.map((node, idx) => (
          <g key={idx}>
            <circle
              cx={node.x}
              cy={node.y}
              r={node.isGen ? (isSelected ? "3.2" : "2.6") : (isSelected ? "2.4" : "2.0")}
              fill={node.isGen ? genFill : nodeFill}
              opacity={isSelected ? "0.95" : "0.75"}
            />
          </g>
        ))}
      </svg>
    </div>
  );
}
