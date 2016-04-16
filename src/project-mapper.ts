import {Readable} from "stream";
import {Serializable, Topology} from "./types";
import fs = require('fs-extra');
import path = require('path');

function collectRelevantDirs(rootDir: string, relevantFile: string): string[] {
    const pkgList = [];
    
    function collect(dir: string) {
        const list: string[] = fs.readdirSync(dir);
        if(list.indexOf(relevantFile) > -1) {
            pkgList.push(dir);
        }
        list.forEach(fileName => {
            const fullName = path.resolve(dir, fileName);
            const stat = fs.statSync(fullName);
            if(stat.isDirectory()) {
                collect(fullName);
            }
        });
    }

    collect(rootDir);
    return pkgList;
}

function resolvePackage(packagePath: string): PackageTuple {
    let packageJson: Object;
    try {
        packageJson = JSON.parse(fs.readFileSync(path.resolve(packagePath, 'package.json')).toString());
    } catch (err) {
        packageJson = {};
    }
    if(packageJson['main']) {
        return [packagePath, packageJson['main']];
    } else {
        return [packagePath, 'index.js'];
    }

}

function buildPkgDict(topology: Topology): PackageDict {
    const headLength = topology.rootDir.length + 'node_modules'.length + 1;
    const pkgList = collectRelevantDirs(path.join(topology.rootDir, 'node_modules'), 'package.json');
    const pkgDict: PackageDict = {};
    pkgList.forEach((pkgPath) => {
        const resolved: PackageTuple = resolvePackage(pkgPath);
        const pkg = topology.libMount + resolved[0].slice(headLength);
        pkgDict[path.basename(pkgPath)] = [pkg, resolved[1]];
    });
    return pkgDict;
}

function collectDirs(rootDir: string, subDir: string, prefix: string): string [] {
    const headLength = rootDir.length + subDir.length + 1;
    return collectRelevantDirs(path.join(rootDir, subDir), 'index.js')
        .map(fullDir => prefix  + fullDir.slice(headLength) + '.js');
}

function buildDefIndexDirs(topology: Topology): string[] {
    return []
        .concat(collectDirs(topology.rootDir, topology.srcDir, topology.srcMount))
        .concat(collectDirs(topology.rootDir, 'node_modules', topology.libMount));
}

export type PackageTuple = [string, string];

export type PackageDict = { [pkgName: string]: PackageTuple };

export interface ProjectMap extends Serializable {
    packages: PackageDict;
    dirs: string[];
}

export function getProjectMap(topology: Topology): ProjectMap {
    const projectMap: ProjectMap = {
        packages: buildPkgDict(topology),
        dirs: buildDefIndexDirs(topology),
        serialize: () => projectMapSerialized
    };
    const projectMapSerialized: string = JSON.stringify(projectMap);
    return projectMap;
}
