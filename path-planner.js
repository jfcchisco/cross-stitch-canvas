export default class PathPlanner {
    constructor(clusterSizeFactor = 5.25) {
        this.clusterSizeFactor = clusterSizeFactor;
    }

    createClusters(stitchesList, cols, threshold) {
        const stitchByCoordinate = new Map();
        for (const stitch of stitchesList) {
            stitch.cluster = -1;
            stitchByCoordinate.set(stitch.Y * cols + stitch.X, stitch);
        }

        const clusters = [];
        for (const seed of stitchesList) {
            if (seed.cluster !== -1) {
                continue;
            }

            const cluster = {
                id: clusters.length,
                stitches: [],
                boundary: [],
                bounds: { minX: seed.X, minY: seed.Y, maxX: seed.X, maxY: seed.Y },
                buckets: new Map()
            };
            const queue = [seed];
            seed.cluster = cluster.id;

            for (let head = 0; head < queue.length; head++) {
                const stitch = queue[head];
                cluster.stitches.push(stitch);
                cluster.bounds.minX = Math.min(cluster.bounds.minX, stitch.X);
                cluster.bounds.minY = Math.min(cluster.bounds.minY, stitch.Y);
                cluster.bounds.maxX = Math.max(cluster.bounds.maxX, stitch.X);
                cluster.bounds.maxY = Math.max(cluster.bounds.maxY, stitch.Y);

                const neighbors = [
                    [stitch.X, stitch.Y - 1],
                    [stitch.X, stitch.Y + 1],
                    [stitch.X - 1, stitch.Y],
                    [stitch.X + 1, stitch.Y]
                ];
                for (const [x, y] of neighbors) {
                    if (x < 0 || x >= cols || y < 0) {
                        continue;
                    }
                    const neighbor = stitchByCoordinate.get(y * cols + x);
                    if (neighbor && neighbor.cluster === -1) {
                        neighbor.cluster = cluster.id;
                        queue.push(neighbor);
                    }
                }
            }
            clusters.push(cluster);
        }

        const bucketSize = Math.max(1, Math.ceil(threshold));
        for (const cluster of clusters) {
            for (const stitch of cluster.stitches) {
                const neighbors = [
                    [stitch.X, stitch.Y - 1],
                    [stitch.X, stitch.Y + 1],
                    [stitch.X - 1, stitch.Y],
                    [stitch.X + 1, stitch.Y]
                ];
                const isBoundary = neighbors.some(([x, y]) => {
                    const neighbor = x < 0 || x >= cols || y < 0
                        ? null
                        : stitchByCoordinate.get(y * cols + x);
                    return !neighbor || neighbor.cluster !== cluster.id;
                });
                if (!isBoundary) {
                    continue;
                }

                cluster.boundary.push(stitch);
                const bucketKey = this.getBucketKey(stitch.X, stitch.Y, bucketSize);
                let bucket = cluster.buckets.get(bucketKey);
                if (!bucket) {
                    bucket = [];
                    cluster.buckets.set(bucketKey, bucket);
                }
                bucket.push(stitch);
            }
        }
        return { clusters, bucketSize };
    }

    getBucketKey(x, y, bucketSize) {
        return `${Math.floor(x / bucketSize)},${Math.floor(y / bucketSize)}`;
    }

    getConnection(first, second, threshold, bucketSize, connectionCache) {
        if (first === second) {
            return null;
        }

        const firstId = Math.min(first.id, second.id);
        const secondId = Math.max(first.id, second.id);
        const cacheKey = `${firstId}:${secondId}`;
        let cached = connectionCache.get(cacheKey);
        if (cached === undefined) {
            const firstBounds = first.bounds;
            const secondBounds = second.bounds;
            const dx = Math.max(0, firstBounds.minX - secondBounds.maxX, secondBounds.minX - firstBounds.maxX);
            const dy = Math.max(0, firstBounds.minY - secondBounds.maxY, secondBounds.minY - firstBounds.maxY);
            if (dx * dx + dy * dy > threshold * threshold) {
                return null;
            }

            let source = first;
            let target = second;
            if (source.boundary.length > target.boundary.length) {
                source = second;
                target = first;
            }

            let bestDistanceSquared = threshold * threshold;
            let sourcePoint = null;
            let targetPoint = null;
            for (const point of source.boundary) {
                const pointBucketX = Math.floor(point.X / bucketSize);
                const pointBucketY = Math.floor(point.Y / bucketSize);
                for (let bucketY = pointBucketY - 1; bucketY <= pointBucketY + 1; bucketY++) {
                    for (let bucketX = pointBucketX - 1; bucketX <= pointBucketX + 1; bucketX++) {
                        const bucket = target.buckets.get(`${bucketX},${bucketY}`);
                        if (!bucket) {
                            continue;
                        }
                        for (const candidate of bucket) {
                            const deltaX = point.X - candidate.X;
                            const deltaY = point.Y - candidate.Y;
                            const distanceSquared = deltaX * deltaX + deltaY * deltaY;
                            if (distanceSquared < bestDistanceSquared ||
                                (!sourcePoint && distanceSquared === bestDistanceSquared)) {
                                bestDistanceSquared = distanceSquared;
                                sourcePoint = point;
                                targetPoint = candidate;
                                if (bestDistanceSquared === 0) {
                                    break;
                                }
                            }
                        }
                        if (bestDistanceSquared === 0) {
                            break;
                        }
                    }
                    if (bestDistanceSquared === 0) {
                        break;
                    }
                }
                if (bestDistanceSquared === 0) {
                    break;
                }
            }

            if (!sourcePoint) {
                return null;
            }
            cached = {
                firstId,
                secondId,
                distance: Math.sqrt(bestDistanceSquared),
                firstPoint: source.id === firstId ? sourcePoint : targetPoint,
                secondPoint: source.id === firstId ? targetPoint : sourcePoint
            };
            connectionCache.set(cacheKey, cached);
            if (connectionCache.size > 20000) {
                connectionCache.delete(connectionCache.keys().next().value);
            }
        }

        if (first.id === cached.firstId) {
            return [
                first.id,
                second.id,
                cached.distance,
                [cached.firstPoint.X, cached.firstPoint.Y],
                [cached.secondPoint.X, cached.secondPoint.Y]
            ];
        }
        return [
            first.id,
            second.id,
            cached.distance,
            [cached.secondPoint.X, cached.secondPoint.Y],
            [cached.firstPoint.X, cached.firstPoint.Y]
        ];
    }

    getClosestCluster(clusters, pointX, pointY) {
        let closestCluster = null;
        let closestDistanceSquared = Infinity;
        for (const cluster of clusters) {
            for (const stitch of cluster.stitches) {
                const dx = stitch.X - pointX;
                const dy = stitch.Y - pointY;
                const distanceSquared = dx * dx + dy * dy;
                if (distanceSquared < closestDistanceSquared) {
                    closestDistanceSquared = distanceSquared;
                    closestCluster = cluster;
                }
            }
        }
        return closestCluster;
    }

    getRouteDistance(route, threshold, bucketSize, connectionCache) {
        let distance = 0;
        for (let index = 1; index < route.length; index++) {
            const connection = this.getConnection(
                route[index - 1],
                route[index],
                threshold,
                bucketSize,
                connectionCache
            );
            if (!connection) {
                return Infinity;
            }
            distance += connection[2] + route[index].stitches.length * this.clusterSizeFactor;
        }
        return distance;
    }

    findBestInsertion(route, clusters, visited, routeDistance, threshold, maxTotalDistance, bucketSize, connectionCache) {
        let bestInsertion = null;
        for (const candidate of clusters) {
            if (visited.has(candidate.id)) {
                continue;
            }

            const serviceCost = candidate.stitches.length * this.clusterSizeFactor;
            for (let position = 1; position <= route.length; position++) {
                const previous = route[position - 1];
                const toCandidate = this.getConnection(previous, candidate, threshold, bucketSize, connectionCache);
                if (!toCandidate) {
                    continue;
                }

                let addedCost = toCandidate[2] + serviceCost;
                if (position < route.length) {
                    const next = route[position];
                    const fromCandidate = this.getConnection(candidate, next, threshold, bucketSize, connectionCache);
                    const replaced = this.getConnection(previous, next, threshold, bucketSize, connectionCache);
                    if (!fromCandidate || !replaced) {
                        continue;
                    }
                    addedCost += fromCandidate[2] - replaced[2];
                }

                if (routeDistance + addedCost > maxTotalDistance) {
                    continue;
                }

                const score = candidate.stitches.length / Math.max(addedCost, 0.001);
                if (!bestInsertion ||
                    score > bestInsertion.score ||
                    (score === bestInsertion.score && candidate.stitches.length > bestInsertion.cluster.stitches.length) ||
                    (score === bestInsertion.score &&
                        candidate.stitches.length === bestInsertion.cluster.stitches.length &&
                        addedCost < bestInsertion.addedCost) ||
                    (score === bestInsertion.score &&
                        candidate.stitches.length === bestInsertion.cluster.stitches.length &&
                        addedCost === bestInsertion.addedCost &&
                        candidate.id < bestInsertion.cluster.id)) {
                    bestInsertion = { cluster: candidate, position, addedCost, score };
                }
            }
        }
        return bestInsertion;
    }

    improveRoute(route, maxTotalDistance, threshold, bucketSize, connectionCache) {
        const maxEvaluations = 5000;
        let routeDistance = this.getRouteDistance(route, threshold, bucketSize, connectionCache);

        for (let pass = 0; pass < 2; pass++) {
            let bestRoute = route;
            let bestDistance = routeDistance;
            let evaluations = 0;

            for (let start = 1; start < route.length && evaluations < maxEvaluations; start++) {
                for (let end = start + 1; end < route.length && evaluations < maxEvaluations; end++) {
                    const reordered = route.slice();
                    const [moved] = reordered.splice(start, 1);
                    reordered.splice(end, 0, moved);
                    const distance = this.getRouteDistance(reordered, threshold, bucketSize, connectionCache);
                    evaluations++;
                    if (distance <= maxTotalDistance && distance < bestDistance) {
                        bestRoute = reordered;
                        bestDistance = distance;
                    }
                }
            }

            for (let start = 1; start < route.length - 1 && evaluations < maxEvaluations; start++) {
                for (let end = start + 1; end < route.length && evaluations < maxEvaluations; end++) {
                    const reordered = route.slice();
                    const reversed = reordered.slice(start, end + 1).reverse();
                    reordered.splice(start, reversed.length, ...reversed);
                    const distance = this.getRouteDistance(reordered, threshold, bucketSize, connectionCache);
                    evaluations++;
                    if (distance <= maxTotalDistance && distance < bestDistance) {
                        bestRoute = reordered;
                        bestDistance = distance;
                    }
                }
            }

            if (bestDistance >= routeDistance) {
                break;
            }
            route = bestRoute;
            routeDistance = bestDistance;
        }
        return { route, distance: routeDistance };
    }

    buildCoveragePath(startCluster, clusters, threshold, maxTotalDistance, bucketSize, connectionCache) {
        if (!startCluster) {
            return { sequence: [], stitchCount: 0, distance: 0 };
        }

        let route = [startCluster];
        let routeDistance = 0;
        const visited = new Set([startCluster.id]);
        while (true) {
            const insertion = this.findBestInsertion(
                route,
                clusters,
                visited,
                routeDistance,
                threshold,
                maxTotalDistance,
                bucketSize,
                connectionCache
            );
            if (insertion) {
                route.splice(insertion.position, 0, insertion.cluster);
                visited.add(insertion.cluster.id);
                routeDistance = this.getRouteDistance(route, threshold, bucketSize, connectionCache);
                continue;
            }

            const improved = this.improveRoute(
                route,
                maxTotalDistance,
                threshold,
                bucketSize,
                connectionCache
            );
            if (improved.distance >= routeDistance) {
                break;
            }
            route = improved.route;
            routeDistance = improved.distance;
        }

        const sequence = [];
        let stitchCount = route[0].stitches.length;
        for (let index = 1; index < route.length; index++) {
            const connection = this.getConnection(
                route[index - 1],
                route[index],
                threshold,
                bucketSize,
                connectionCache
            );
            if (connection) {
                sequence.push(connection);
                stitchCount += route[index].stitches.length;
            }
        }
        return { sequence, stitchCount, distance: routeDistance };
    }
}
