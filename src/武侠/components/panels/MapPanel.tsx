import React from 'react';
import { Icons } from '../Icons';

/* --- Map Panel --- */
export const MapPanel: React.FC = () => {
    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
             <Icons.Map size={48} color="#44403c" />
             <div style={{ color: '#78716c', fontFamily: 'serif', fontSize: '1.2rem' }}>九州方圆 尽在心中</div>
             <div style={{ fontSize: '0.9rem', color: '#57534e' }}>（地图功能正在绘制中...）</div>
        </div>
    );
};
