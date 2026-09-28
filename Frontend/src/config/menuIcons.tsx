import {
  FaHome,
  FaCalendarAlt,
  FaUserCircle,
  FaFolderOpen,
  FaTasks,
  FaClipboardCheck,
  FaBug,
  FaChartPie,
  FaUsersCog,
  FaWrench,
  FaDatabase,
  FaCode,
  FaPlay,
  FaVideo,
  FaSitemap,
  FaCog,
  FaList,
  FaUsers,
  FaUserShield,
  FaBuilding,
  FaLayerGroup,
  FaProjectDiagram,
  FaFileAlt,
  FaCheckCircle,
  FaRobot,
  FaBolt,
  FaColumns,
} from "react-icons/fa";

import type { IconType } from "react-icons";

export const menuIconRegistry: Record<string, IconType> = {
  FaHome,
  FaCalendarAlt,
  FaUserCircle,
  FaFolderOpen,
  FaTasks,
  FaClipboardCheck,
  FaBug,
  FaChartPie,
  FaUsersCog,
  FaWrench,
  FaDatabase,
  FaCode,
  FaPlay,
  FaVideo,
  FaSitemap,
  FaCog,
  FaList,
  FaUsers,
  FaUserShield,
  FaBuilding,
  FaLayerGroup,
  FaProjectDiagram,
  FaFileAlt,
  FaCheckCircle,
  FaRobot,
  FaBolt,
  FaColumns,
};

export const availableMenuIcons = Object.keys(menuIconRegistry).sort();

export const getMenuIcon = (iconName?: string | null): IconType => {
  if (iconName && menuIconRegistry[iconName]) {
    return menuIconRegistry[iconName];
  }

  return FaList;
};
