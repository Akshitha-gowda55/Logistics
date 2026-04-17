from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.entities import (
    AuditLogModel,
    InventoryModel,
    NotificationModel,
    RouteModel,
    RouteReliabilityModel,
    ShipmentModel,
    SupplierModel,
    UserModel,
    WorkflowModel,
    WorkflowStageUpdateModel,
)
from app.models.enums import AlertType, UserRole, WorkflowStage, WorkflowStatus
from app.services.routing_geometry import build_multileg_road_style, build_simulated_road_polyline

_M_LAT, _M_LNG = 19.076, 72.8777
_D_LAT, _D_LNG = 28.6139, 77.209


def seed_demo_data(db: Session) -> None:
    has_users = db.scalar(select(UserModel.id).limit(1))
    if has_users:
        return

    users = [
        UserModel(name="Aarav Mehta", email="executive@smartflow.ai", password_hash=hash_password("demo1234"), role=UserRole.executive),
        UserModel(name="Priya Sharma", email="operations@smartflow.ai", password_hash=hash_password("demo1234"), role=UserRole.operations),
        UserModel(name="Rohan Kapoor", email="inventory@smartflow.ai", password_hash=hash_password("demo1234"), role=UserRole.inventory),
        UserModel(name="Neha Iyer", email="supplier@smartflow.ai", password_hash=hash_password("demo1234"), role=UserRole.supplier_risk),
    ]
    db.add_all(users)
    db.flush()

    wf1 = WorkflowModel(
        workflow_id="WF-102",
        shipment_id="SHP-221",
        title="North Zone Electronics Replenishment",
        description="Move priority electronics from Mumbai DC to Delhi warehouse",
        priority="High",
        source_location="Mumbai DC",
        destination_location="Delhi WH-01",
        current_stage=WorkflowStage.operations,
        current_role=UserRole.operations,
        assigned_user_id=users[1].id,
        assigned_role=UserRole.operations,
        status=WorkflowStatus.in_progress,
        progress_percent=35,
        due_date=datetime.utcnow() + timedelta(days=2),
        remarks="Dispatch in progress",
    )
    wf2 = WorkflowModel(
        workflow_id="WF-118",
        shipment_id="SHP-305",
        title="FMCG Safety Stock Recovery",
        description="Stock balancing after demand spike in south region",
        priority="Critical",
        source_location="Bengaluru WH-03",
        destination_location="Chennai WH-07",
        current_stage=WorkflowStage.inventory,
        current_role=UserRole.inventory,
        assigned_user_id=users[2].id,
        assigned_role=UserRole.inventory,
        status=WorkflowStatus.assigned,
        progress_percent=62,
        due_date=datetime.utcnow() + timedelta(days=1),
    )
    wf3 = WorkflowModel(
        workflow_id="WF-134",
        shipment_id="SHP-448",
        title="Supplier Delay Mitigation - Pharma Cold Chain",
        description="Critical cold-chain shipment requiring supplier mitigation and route stability.",
        priority="Critical",
        source_location="Hyderabad Hub",
        destination_location="Kolkata WH-02",
        current_stage=WorkflowStage.supplier_risk,
        current_role=UserRole.supplier_risk,
        assigned_user_id=users[3].id,
        assigned_role=UserRole.supplier_risk,
        status=WorkflowStatus.escalated,
        progress_percent=86,
        due_date=datetime.utcnow() + timedelta(hours=18),
        remarks="Alternate supplier under review.",
    )
    wf4 = WorkflowModel(
        workflow_id="WF-140",
        shipment_id="SHP-503",
        title="Executive Planning - Seasonal Demand Ramp",
        description="Planning stage workflow for seasonal demand capacity alignment.",
        priority="Medium",
        source_location="Pune DC",
        destination_location="Lucknow WH-05",
        current_stage=WorkflowStage.planning,
        current_role=UserRole.executive,
        assigned_user_id=users[0].id,
        assigned_role=UserRole.executive,
        status=WorkflowStatus.assigned,
        progress_percent=12,
        due_date=datetime.utcnow() + timedelta(days=4),
        remarks="Awaiting final approval and budget sign-off.",
    )
    db.add_all([wf1, wf2, wf3, wf4])
    db.flush()

    db.add_all(
        [
            WorkflowStageUpdateModel(
                workflow_id=wf1.id,
                stage_name=WorkflowStage.planning,
                role=UserRole.executive,
                updated_by_user_id=users[0].id,
                previous_status=WorkflowStatus.pending,
                new_status=WorkflowStatus.completed,
                remark="Planning approved by executive",
                started_at=datetime.utcnow() - timedelta(days=2),
                completed_at=datetime.utcnow() - timedelta(days=2, hours=-2),
            ),
            WorkflowStageUpdateModel(
                workflow_id=wf2.id,
                stage_name=WorkflowStage.operations,
                role=UserRole.operations,
                updated_by_user_id=users[1].id,
                previous_status=WorkflowStatus.in_progress,
                new_status=WorkflowStatus.completed,
                remark="Shipment delivered to warehouse gate",
                started_at=datetime.utcnow() - timedelta(days=1),
                completed_at=datetime.utcnow() - timedelta(hours=10),
            ),
            WorkflowStageUpdateModel(
                workflow_id=wf3.id,
                stage_name=WorkflowStage.planning,
                role=UserRole.executive,
                updated_by_user_id=users[0].id,
                previous_status=WorkflowStatus.pending,
                new_status=WorkflowStatus.completed,
                remark="Executive approved workflow and moved to operations.",
                started_at=datetime.utcnow() - timedelta(days=3),
                completed_at=datetime.utcnow() - timedelta(days=3, hours=-3),
            ),
            WorkflowStageUpdateModel(
                workflow_id=wf3.id,
                stage_name=WorkflowStage.operations,
                role=UserRole.operations,
                updated_by_user_id=users[1].id,
                previous_status=WorkflowStatus.assigned,
                new_status=WorkflowStatus.completed,
                remark="Shipment moved to risk stage due to supplier disruption signal.",
                started_at=datetime.utcnow() - timedelta(days=2),
                completed_at=datetime.utcnow() - timedelta(days=1, hours=5),
            ),
        ]
    )

    routes = [
        RouteModel(
            route_code="R-A1",
            source_location="Mumbai",
            destination_location="Delhi",
            distance_km=1410.0,
            expected_time_hours=22.0,
            route_cost=4300.0,
            co2_estimate=980.0,
            disruption_risk="low",
            path_coordinates=build_simulated_road_polyline(_M_LAT, _M_LNG, _D_LAT, _D_LNG, variant=0, num_points=88),
        ),
        RouteModel(
            route_code="R-B2-RAIL",
            source_location="Mumbai",
            destination_location="Delhi",
            distance_km=1360.0,
            expected_time_hours=24.0,
            route_cost=3900.0,
            co2_estimate=740.0,
            disruption_risk="medium",
            path_coordinates=build_multileg_road_style(_M_LAT, _M_LNG, _D_LAT, _D_LNG, variant=2, mid_frac=0.4, points_per_leg=48),
        ),
        RouteModel(
            route_code="R-C3",
            source_location="Mumbai",
            destination_location="Delhi",
            distance_km=1490.0,
            expected_time_hours=28.0,
            route_cost=3600.0,
            co2_estimate=920.0,
            disruption_risk="high",
            path_coordinates=build_simulated_road_polyline(_M_LAT, _M_LNG, _D_LAT, _D_LNG, variant=7, num_points=92, base_wiggle_km=52.0),
        ),
        RouteModel(
            route_code="R-D4-MM",
            source_location="Mumbai",
            destination_location="Delhi",
            distance_km=1425.0,
            expected_time_hours=20.5,
            route_cost=5200.0,
            co2_estimate=860.0,
            disruption_risk="low",
            path_coordinates=build_multileg_road_style(_M_LAT, _M_LNG, _D_LAT, _D_LNG, variant=4, mid_frac=0.52, points_per_leg=46),
        ),
        RouteModel(
            route_code="R-E5-AIR",
            source_location="Mumbai",
            destination_location="Delhi",
            distance_km=1140.0,
            expected_time_hours=8.0,
            route_cost=8400.0,
            co2_estimate=1600.0,
            disruption_risk="low",
            path_coordinates=build_simulated_road_polyline(_M_LAT, _M_LNG, _D_LAT, _D_LNG, variant=3, num_points=72, base_wiggle_km=8.0),
        ),
    ]
    db.add_all(routes)
    db.flush()

    db.add_all(
        [
            RouteReliabilityModel(route_id=routes[0].id, carrier_name="PrimeRoad Carriers", on_time_rate=0.91, disruption_rate=0.06, capacity_utilization=0.72, sample_size=140),
            RouteReliabilityModel(route_id=routes[1].id, carrier_name="RailLink Logistics", on_time_rate=0.88, disruption_rate=0.10, capacity_utilization=0.78, sample_size=96),
            RouteReliabilityModel(route_id=routes[2].id, carrier_name="ShieldHaul Premium", on_time_rate=0.82, disruption_rate=0.18, capacity_utilization=0.81, sample_size=78),
            RouteReliabilityModel(route_id=routes[3].id, carrier_name="OmniChain 3PL", on_time_rate=0.9, disruption_rate=0.07, capacity_utilization=0.86, sample_size=64),
            RouteReliabilityModel(route_id=routes[4].id, carrier_name="SkyFreight Express", on_time_rate=0.93, disruption_rate=0.05, capacity_utilization=0.67, sample_size=52),
        ]
    )

    db.add(
        ShipmentModel(
            shipment_id="SHP-221",
            workflow_id=wf1.id,
            source_location=wf1.source_location,
            destination_location=wf1.destination_location,
            current_lat=None,
            current_lng=None,
            current_status="in transit",
            eta=datetime.utcnow() + timedelta(hours=7),
            selected_route_id=routes[0].id,
            progress_percent=58,
        )
    )
    db.add_all(
        [
            ShipmentModel(
                shipment_id="SHP-305",
                workflow_id=wf2.id,
                source_location=wf2.source_location,
                destination_location=wf2.destination_location,
                current_lat=None,
                current_lng=None,
                current_status="at warehouse",
                eta=datetime.utcnow() + timedelta(hours=12),
                selected_route_id=routes[1].id,
                progress_percent=64,
            ),
            ShipmentModel(
                shipment_id="SHP-448",
                workflow_id=wf3.id,
                source_location=wf3.source_location,
                destination_location=wf3.destination_location,
                current_lat=None,
                current_lng=None,
                current_status="delayed",
                eta=datetime.utcnow() + timedelta(hours=20),
                selected_route_id=routes[3].id,
                progress_percent=81,
            ),
            ShipmentModel(
                shipment_id="SHP-503",
                workflow_id=wf4.id,
                source_location=wf4.source_location,
                destination_location=wf4.destination_location,
                current_lat=None,
                current_lng=None,
                current_status="not_started",
                eta=datetime.utcnow() + timedelta(days=2),
                selected_route_id=routes[2].id,
                progress_percent=10,
            ),
        ]
    )

    db.add_all(
        [
            SupplierModel(
                supplier_code="SUP-1001",
                supplier_name="Apex Components",
                region="West",
                lead_time_days=8,
                average_delay_rate=0.31,
                disruption_count=5,
                risk_score=82.0,
                status="active",
            ),
            InventoryModel(
                warehouse_id="WH-DEL-01",
                warehouse_name="Delhi WH-01",
                product_code="ELEC-8891",
                product_name="Industrial Sensor",
                stock_level=1240,
                safety_stock=980,
                reorder_point=1020,
            ),
            InventoryModel(
                warehouse_id="WH-BLR-03",
                warehouse_name="Bengaluru WH-03",
                product_code="ELEC-4210",
                product_name="Controller Unit",
                stock_level=620,
                safety_stock=840,
                reorder_point=900,
                shortage_flag=True,
            ),
            InventoryModel(
                warehouse_id="WH-MUM-02",
                warehouse_name="Mumbai DC",
                product_code="FMCG-102",
                product_name="Packaged Nutrition Kit",
                stock_level=2540,
                safety_stock=1200,
                reorder_point=1380,
                excess_flag=True,
            ),
        ]
    )

    db.add_all(
        [
            NotificationModel(
                target_role=UserRole.operations,
                message="Executive approved workflow WF-102. Operations action required.",
                type=AlertType.info,
                related_workflow_id="WF-102",
            ),
            NotificationModel(
                target_role=UserRole.inventory,
                message="Operations completed shipment SHP-305. Inventory stage is now active.",
                type=AlertType.success,
                related_workflow_id="WF-118",
            ),
            NotificationModel(
                target_role=UserRole.supplier_risk,
                message="Inventory marked shortage for SHP-448. Supplier/Risk intervention required.",
                type=AlertType.warning,
                related_workflow_id="WF-134",
            ),
            NotificationModel(
                target_role=UserRole.executive,
                message="Supplier case WF-134 escalated. Executive review is required.",
                type=AlertType.critical,
                related_workflow_id="WF-134",
            ),
        ]
    )

    db.add_all(
        [
            AuditLogModel(
                user_id=users[0].id,
                workflow_id=wf1.id,
                action_type="WORKFLOW_CREATED",
                module_name="workflow_engine",
                details='{"role":"executive","workflow_id":"WF-102","previous_status":"Pending","new_status":"Assigned","details":"Created workflow and assigned to operations"}',
            ),
            AuditLogModel(
                user_id=users[1].id,
                workflow_id=wf1.id,
                action_type="WORKFLOW_STATUS_UPDATED",
                module_name="workflow_engine",
                details='{"role":"operations","workflow_id":"WF-102","previous_status":"Assigned","new_status":"In Progress","remark":"Dispatch initiated"}',
            ),
            AuditLogModel(
                user_id=users[2].id,
                workflow_id=wf2.id,
                action_type="WORKFLOW_STAGE_COMPLETED",
                module_name="workflow_engine",
                details='{"role":"inventory","workflow_id":"WF-118","previous_status":"In Progress","new_status":"Completed","remark":"Stock received and verified"}',
            ),
            AuditLogModel(
                user_id=users[3].id,
                workflow_id=wf3.id,
                action_type="REROUTE_RECOMMENDED",
                module_name="route_recommendation",
                details='{"role":"supplier_risk","workflow_id":"WF-134","disruption_event":"supplier_delay","force":true}',
            ),
        ]
    )

    db.commit()
